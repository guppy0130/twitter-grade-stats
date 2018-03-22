// First get env vars
require('dotenv').config();

// Dependencies
const twitter = require('twit');
const express = require('express');
const textStatistics = require('text-statistics');
const hbs = require('hbs');
const reload = require('reload');
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
	include_rts: false,
	tweet_mode: 'extended'
}

client.get('statuses/user_timeline', params, function(error, tweets, response) {
    var cleanSentenceArr = [],
        gradeArr = [],
		tweetGlobal = [];
	if (error) {
		console.log(error);
		return
	}
    tweets.forEach(function(element, index, array) {
        var cleanedSentence = cleanText(element.full_text);
		if (cleanedSentence == ' ') {
			return;
		}
        var gradeLevel = textStatistics(cleanedSentence).fleschKincaidGradeLevel();
		gradeLevel = gradeLevel > 0 ? gradeLevel : 0;
        gradeArr.push(gradeLevel);
		tweetGlobal.push({
			id: element.id,
			text: cleanedSentence,
			gradeLevel: gradeLevel
		});
    });
	content['tweets'] = tweetGlobal;
	return gradeArr;
}).then(function(gradeArr) {
	//TODO: calculate grades 'n stuff
});

function cleanText(input) {
    const regexURL = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gim,
          regexHash = /\S*#(?:\[[^\]]+\]|\S+)/gim,
          regexUsername = /(^|[^@\w])@(\w{1,15})\b\ /gim,
          regexHTMLGT = /\&gt\;(\ )?/gim;
    var result = input.replace(regexURL, '').replace(regexHash, '').replace(regexUsername, '').replace(regexHTMLGT, '').replace(/\n/gim, '. ').trim() + '.';
	return result == '.' ? ' ' : result;
};

let content = {
    title: 'Testing'
};

hbs.registerPartials(__dirname + '/views/partials', () => {
	console.log('partials registered');
});

hbs.registerHelper('item', function(param) {
	console.log(param);
	return param;
});

express()
    .set('view engine', 'hbs')
    .set('views', './views')
    .get('/', (req, res) => res.render('index', content))
    .listen(port, () => console.log(`Listening on ${ port }`));
