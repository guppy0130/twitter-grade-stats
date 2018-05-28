/* jslint node:true */
// Dependencies
const twitter = require('twit');
const express = require('express');
const textStatistics = require('text-statistics');
const hbs = require('hbs');
const he = require('he');
const ss = require('simple-statistics');
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
          regexNewLine = /\n/gim;
    var result = he.decode(input.replace(regexURL, '').replace(regexHash, '').replace(regexUsername, '').replace(regexNewLine, '. ').trim() + '.');
	return (result == '.' ? ' ' : result);
}

let index = {
	title: "Twitter Grade Stats"
};

hbs.registerPartials(__dirname + '/views/partials');

const getTweetMiddleware = async (req, res, next) => {
	params['screen_name'] = req.query.username;
    let gradeArray = [];
	client.get('statuses/user_timeline', params).then((response) => {
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
        } else if (response.resp.statusCode === 401) {
            Promise.reject().catch(() => {
                res.render('404', {
                    name: req.query.username,
                    reason: "was suspended"
                });
            });
        } else if (response.resp.statusCode === 200) {
            return response.data.map(element => {
                let cleanedText = cleanText(element.full_text);
                let grade = textStatistics(cleanedText).fleschKincaidGradeLevel();
                gradeArray.push(grade);
                return {
                    id: element.id_str,
                    text: cleanedText,
                    grade: grade
                };
            });
        }
    }).then((tweets) => {
        if (tweets !== undefined) {
            req.tweets = tweets;
            gradeArray.sort((a, b) => {return a - b});
            let bins = {};
            let ideal = {};
            for (let i = Math.floor(gradeArray[0]); // min val
                 i < Math.floor(gradeArray[gradeArray.length - 1] + 1); // max val
                 i++) {
                bins[i] = 0;
                ideal[i] = 0;
            }
            bins = gradeArray.reduce((all, value) => {
                all[Math.floor(value)]++;
                return all;
            }, bins);

            const marsaglia = (mean, stdDev) => {
                let v1, v2, s, multiplier;
                do {
                    v1 = 2 * Math.random() - 1; // between -1 and 1
                    v2 = 2 * Math.random() - 1; // between -1 and 1
                    s = v1 * v1 + v2 * v2;
                } while (s >= 1 || s == 0);
                multiplier = Math.sqrt(-2 * Math.log(s) / s);
                return (v1 * multiplier * stdDev) + mean;
            };
            idealArray = [];
            for (let i = 0; i < tweets.length * 3; i++) {
                idealArray.push(marsaglia(ss.mean(gradeArray), ss.sampleStandardDeviation(gradeArray)));
            }
            ideal = idealArray.reduce((all, value) => {
                all[Math.floor(value)]++;
                return all;
            }, ideal);

            req.stats = {
                min: ss.minSorted(gradeArray),
                max: ss.maxSorted(gradeArray),
                median: ss.medianSorted(gradeArray),
                sampMean: ss.mean(gradeArray),
                sampStdDev: ss.sampleStandardDeviation(gradeArray),
                bins: JSON.stringify(bins),
                ideal: JSON.stringify(ideal)
            }
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
		tweets: req.tweets,
        stats: req.stats
	});
});

express()
    .set('view engine', 'hbs')
    .set('views', './views')
    .get('/', (req, res) => res.render('index', index))
	.get('/user/', user)
    .listen(port, () => console.log(`Listening on ${ port }`));
