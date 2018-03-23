// First get env vars
require('dotenv').config();

// Dependencies
const twitter = require('twit');
const express = require('express');
const textStatistics = require('text-statistics');
const hbs = require('hbs');
const reload = require('reload');
const port = process.env.PORT || 3000;

const client = new twitter({
	consumer_key: process.env.TwitterConsumerKey,
	consumer_secret: process.env.TwitterConsumerSecret,
	app_only_auth: true
});

const params = {
	count: 200,
	trim_user: true,
	exclude_replies: false,
	include_rts: false,
	tweet_mode: 'extended'
}

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
});

hbs.registerHelper('item', function(param) {
	return param;
});

const getTweetMiddleware = async (req, res, next) => {
	params['screen_name'] = req.query.username;
	client.get('statuses/user_timeline', params)
		.catch((err) => {})
		.then((data, response) => {
			return data.data.map(element => {
				var cleanedText = cleanText(element.full_text)
				return {
					id: element.id,
					text: cleanedText,
					grade: textStatistics(cleanedText).fleschKincaidGradeLevel()
				};
			});
		})
		.then((tweets) => {
			req.tweets = JSON.stringify(tweets);
			next();
		}).catch(err => {
			req.tweets = JSON.stringify("An error occured. Are you sure you entered an appropriate handle?");
			next();
		});   
};

user = express.Router();
user.use('/user/', getTweetMiddleware, async (req, res) => {
	res.render('user', {
		title: req.query.username,
		tweets: JSON.parse(req.tweets)
	});
});

express()
    .set('view engine', 'hbs')
    .set('views', './views')
    .get('/', (req, res) => res.render('index', content))
	.get('/user/', user)
    .listen(port, () => console.log(`Listening on ${ port }`));

