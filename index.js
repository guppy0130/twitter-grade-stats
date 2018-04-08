/* jslint node:true */
// Dependencies
const twitter = require('twit');
const express = require('express');
const textStatistics = require('text-statistics');
const hbs = require('hbs');
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
};

function cleanText(input) {
    const regexURL = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gim,
          regexHash = /\S*#(?:\[[^\]]+\]|\S+)/gim,
          regexUsername = /(^|[^@\w])@(\w{1,15})\b\ /gim,
          regexHTMLGT = /\&gt\;(\ )?/gim;
    var result = input.replace(regexURL, '').replace(regexHash, '').replace(regexUsername, '').replace(regexHTMLGT, '').replace(/\n/gim, '. ').trim() + '.';
	return result == '.' ? ' ' : result;
}

let index = {
	title: "Twitter Grade Stats"
};

hbs.registerPartials(__dirname + '/views/partials');

hbs.registerHelper('item', function(param) {
	return param;
});

const getTweetMiddleware = async (req, res, next) => {
	params['screen_name'] = req.query.username;
	client.get('statuses/user_timeline', params).catch((err) => {

    }).then((response) => {
        console.log(req.query.username + ' resulted in a ' + response.resp.statusCode + ' response. Requests remaining: ' + response.resp.headers['x-rate-limit-remaining']);
        if (response.resp.statusCode === 404) {
            Promise.reject().catch(() => {
                res.render('404', {
                    name: req.query.username,
                    reason: "doesn't exist"
                });
            });
        } else if (response.resp.statusCode === 429) {
            Promise.reject().catch(() => {
                res.render('empty', {
                    time: new Date(response.resp.headers['x-rate-limit-reset'] * 1000)
                });
            });
        } else if (response.resp.statusCode === 200) {
            return response.data.map(element => {
                var cleanedText = cleanText(element.full_text)
                return {
                    id: element.id_str,
                    text: cleanedText,
                    grade: textStatistics(cleanedText).fleschKincaidGradeLevel()
                };
            });
        } else if (response.resp.statusCode === 401) {
            Promise.reject().catch(() => {
                res.render('404', {
                    name: req.query.username,
                    reason: "was suspended"
                })
            });
        }
    }).then((tweets) => {
        if (tweets != undefined) {
            req.tweets = JSON.stringify(tweets);
            next();
        } else {
            Promise.reject().catch(() => {});
        }
    }).catch(err => {
        console.log('try not to end up here with error ' + err);
        res.render('404', {
            name: req.query.username,
            reason: "caused something to break"
        });
    });
};

user = express.Router();
user.use('/user/', getTweetMiddleware, async (req, res) => {
	res.render('user', {
		title: req.query.username + "'s Tweets",
		tweets: JSON.parse(req.tweets)
	});
});

express()
    .set('view engine', 'hbs')
    .set('views', './views')
    .get('/', (req, res) => res.render('index', index))
	.get('/user/', user)
    .listen(port, () => console.log(`Listening on ${ port }`));

