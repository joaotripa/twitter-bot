console.log('The bot is starting');

const Twitter = require('twitter');
const configs = require('./config.js');
const T = new Twitter(configs);
const fs = require('fs');
const request = require('request');
const ytdl = require('ytdl-core');
const dotenv = require('dotenv');
dotenv.config();
const nasa = require('nasa-sdk');

nasa.setNasaApiKey(process.env.NASA_API_KEY);

const LAST_MENTIONS_ID_FILE = 'last_checked_id.txt';
const APOD_PIC_OF_THE_DAY_FILE = 'apod_pic_of_the_day.json';

const pathToAPODImage = 'apodpicture.jpg';
var mediaType;
var mediaData;
var mediaSize;


getMentions();
setInterval(getMentions, 1000*60*1); //Checks  and responds to @mentions in 1 minute intervals

getApodPicOfTheDay();
setInterval(getApodPicOfTheDay, 1000*60*60*24); //Tweets the APOD each day

/**
 * (Utility function) Send a GET request to the Twitter API
 * Gets the @mentions of the bot.
 */
function getMentions(){

        var last_id = fs.readFileSync(LAST_MENTIONS_ID_FILE, 'utf8');
        console.log('Last Mention ID: ' + last_id);

        var params = {
                since_id: last_id
        }

        T.get('statuses/mentions_timeline', params, gotMentions);

}

/**
 * (Utility function) Method that runs after getting the @mentions of the bot.
 * And for all of the mentions, this method will respond to all of them with a pre-defined tweet.
 * @param String err            Error if GET Request fails
 * @param Object data           Data from the GET Request
 * @param String response       Response of the GET Request
 */
function gotMentions(err, data, response){
        if(!err){
                var mentions = data;
                for(var i=(mentions.length - 1); i >= 0 ; i--){
                        var id = mentions[i].id;
                        var id_str = mentions[i].id_str;
                        var screenName = mentions[i].user.screen_name;
                        var text = mentions[i].text;
                        console.log('ID: ' + id);
                        console.log('ID_STR: ' + id_str);
                        console.log('From user: ' + screenName);
                        console.log('Text: ' + text);

                        var response = '@' + screenName + ' Thank you for your tweet! For more content check @NASA \r\n Also check the official @APOD';
                        responseTweet(response,id_str);

                        fs.writeFileSync(LAST_MENTIONS_ID_FILE, id);
                }

        } else {
                console.log(err);
        }
}

/**
 * (Utility function) Tweets a response to a @mention .
 * @param String txt                            Text of the tweet.
 * @param String in_reply_to_status_id          Id of the @mention tweet.
 */
function responseTweet(txt, in_reply_to_status_id){

        var tweet = {
                status: txt,
                auto_populate_reply_metadata: true,
                in_reply_to_status_id: in_reply_to_status_id

        }

        T.post('statuses/update', tweet, tweeted);

        function tweeted(error, data, response){
                if(!error){
                        console.log("Bot tweeted: " + tweet.status);
                } else {
                        console.log(error);
                }
        }
}

//*Get APOD Picture of the Day and Post It
//getApodPicOfTheDay();

/**
 * (Utility function) Fetches the APOD and calls other functions to upload and tweet
 * In case APOD is a youtube video, tweets it immediately.
 */
function getApodPicOfTheDay(){
        nasa.APOD.fetch()
        .then(data => retrieveData(data))
        .catch(err => console.log(err));

        function retrieveData(data){
                //console.log(data);
                var last_pic = JSON.parse(fs.readFileSync(APOD_PIC_OF_THE_DAY_FILE,'utf8'));
                if(data.date != last_pic.date){
                        var title = data.title;
                        var url = data.url;
                        var media_type = data.media_type;
                        var date = data.date;
                        date = date.substring(2);
                        date = date.replace(/-/g,'');

                        if(media_type == 'image' || media_type == 'gif'){
                                mediaType = 'image/gif';
                                downloadAPODImageGif(title, date, url, pathToAPODImage);

                        }
                        else if(media_type == 'video'){
                                var codeId = url.substring(30,41);
                                var newTweet = 'Astronomy Picture of the Day: https://apod.nasa.gov/apod/ap'
                                + date + '.html' + ' by @NASA \r\n' + '\r\n' + title + '\r\n'
                                + 'https://www.youtube.com/watch?v=' + codeId;
                                tweetIt(newTweet);
                        }



                        var json = JSON.stringify(data,null,2);
                        fs.writeFileSync(APOD_PIC_OF_THE_DAY_FILE,json);
                }
        }
}

/**
 * Step 1 of 3: Initialize a media upload
 * @return Promise resolving to String mediaId
 */
function initUpload () {
        return makePost('media/upload', {
                command    : 'INIT',
                total_bytes: mediaSize,
                media_type : mediaType,
        }).then(data => data.media_id_string).catch(error => console.log(error));
}

/**
 * Step 2 of 3: Append file chunk
 * @param String mediaId    Reference to media object being uploaded
 * @return Promise resolving to String mediaId (for chaining)
 */
function appendUpload (mediaId) {
        return makePost('media/upload', {
                command      : 'APPEND',
                media_id     : mediaId,
                media        : mediaData,
                segment_index: 0
        }).then(data => mediaId).catch(error => console.log(error));
}

/**
 * Step 3 of 3: Finalize upload
 * @param String mediaId   Reference to media
 * @return Promise resolving to mediaId (for chaining)
 */
function finalizeUpload (mediaId) {
        return makePost('media/upload', {
                command : 'FINALIZE',
                media_id: mediaId
        }).then(data => mediaId).catch(error => console.log(error));
}

/**
 * (Utility function) Send a POST request to the Twitter API
 * @param String endpoint  e.g. 'statuses/upload'
 * @param Object params    Params object to send
 * @return Promise         Rejects if response is error
 */
function makePost (endpoint, params) {
        return new Promise((resolve, reject) => {
                T.post(endpoint, params, (error, data, response) => {
                        if (error) {
                                reject(error);
                        } else {
                                resolve(data);
                        }
                });
        });
}

/**
 * (Utility function) Downloads the APOD Image/GIF so it can be uploaded.
 * @param String title     Title of the APOD Image/GIF
 * @param String date      Date of the APOD Image/GIF
 * @param String url       Url of the APOD Image/GIF
 * @param String filename  Name of the file where the image is stored.
 */
function downloadAPODImageGif(title,date,url, filename){
        var download = function(uri, filename, callback){
                request.head(uri, function(err, res, body){
                        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
                });
        };

        download(url, filename , function(){
                mediaData  = require('fs').readFileSync(filename);
                mediaSize  = require('fs').statSync(filename).size;
                console.log('Media Size: ' + mediaSize);
                uploadMediaTweet(title, date);
                console.log('Downloaded');
        });
}

/**
 * (Utility function) Uploads the APOD Image/GIF and Tweets it.
 * @param String title     Title of the APOD Image/GIF
 * @param String date      Date of the APOD Image/GIF
 */
function uploadMediaTweet(title, date){
        initUpload() // Declare that you wish to upload some media
        .then(appendUpload) // Send the data for the media
        .then(finalizeUpload) // Declare that you are done uploading chunks
        .then(mediaId => {
                console.log(mediaId);
                // You now have an uploaded movie/animated gif
                // that you can reference in Tweets, e.g. `update/statuses`
                // will take a `mediaIds` param.
                var newTweet = title + '\r\n' + 'Astronomy Picture of the Day: https://apod.nasa.gov/apod/ap'+ date + '.html' + ' by @NASA';
                tweetMedia(newTweet, mediaId);
        }).catch(error => console.log(error));
}


//* Tweet Something Repeatedly
// tweetIt();
// setInterval(tweetIt, 1000*60);

/**
 * (Utility function) Tweets with a pre-defined text.
 * @param String txt     Text of the tweet.
 */
function tweetIt(txt){
        var tweet = {
                status: txt
        }

        T.post('statuses/update', tweet, tweeted);

        function tweeted(error, data, response){
                if(!error){
                        console.log("Bot tweeted: " + tweet.status);
                } else {
                        console.log(error);
                }
        }
}

/**
 * (Utility function) Tweets with a pre-defined text and media.
 * @param String txt     Text of the tweet.
 * @param String mediaId Id of the uploaded media.
 */
function tweetMedia(txt, mediaId){
        var tweet = {
                status: txt,
                media_ids: mediaId
        }

        T.post('statuses/update', tweet, tweeted);

        function tweeted(error, data, response){
                if(!error){
                        console.log("Bot tweeted: " + tweet.status);
                } else {
                        console.log(error);
                }
        }
}
