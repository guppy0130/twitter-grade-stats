// First get env vars
require('dotenv').config();

// Dependencies
const twitter = require('twit');
const express = require('express');
const textStatistics = require('text-statistics');
const port = process.env.port || 5000;

const client = new twitter({
	consumer_key: process.env.TwitterConsumerKey,
	consumer_secret: process.env.TwitterConsumerSecret,
	app_only_auth: true
});

const params = {
	screen_name: 'yanglangthang',
	count: 200,
	trim_user: true,
	exclude_replies: false,
	include_rts: false
}

client.get('statuses/user_timeline', params, function(error, tweets, response) {
    var cleanSentenceArr = [],
        gradeArr = [];
	if (error) {
		console.log(error);
		return
	}
    tweets.forEach(function(element, index, array) {
        var cleanedSentence = cleanText(element.text);
        cleanSentenceArr.push(cleanedSentence);
        var gradeLevel = textStatistics(cleanedSentence).fleschKincaidGradeLevel();
        gradeArr.push(gradeLevel > 0 ? gradeLevel : 0);
    });
    console.log(cleanSentenceArr);
    console.log(gradeArr);
});

function cleanText(input) {
    const regexURL = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gim,
          regexHash = /\S*#(?:\[[^\]]+\]|\S+)/gim,
          regexUsername = /(^|[^@\w])@(\w{1,15})\b\ /gim,
          regexHTMLGT = /\&gt\;(\ )?/gim;
    return input.replace(regexURL, '').replace(regexHash, '').replace(regexUsername, '').replace(regexHTMLGT, '').replace(/\n/gim, '. ').trim() + '.';
}

express()
    .get('/', (req, res) => res.send('Hello World'))
    .listen(port, () => console.log(`Listening on ${ port }`));
