// Global vars
const production = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 3000;

// Dependencies
const twitter = require('twit');
const express = require('express');
const textStatistics = require('text-statistics');
const hbs = require('hbs');
const he = require('he');
const ss = require('simple-statistics');
const compression = require('compression');
const minify = require('express-minify-html');
const enforce = require('express-sslify');

let app = express();
if (!production) {
    const reload = require('reload');
    reload(app);
}

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
    let result = he.decode(input.replace(regexURL, '').replace(regexHash, '').replace(regexUsername, '').replace(regexNewLine, '. ').trim() + '.');
    return (result == '.' ? ' ' : result);
}

let index = {
    title: 'Twitter Grade Stats'
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
                    reason: 'doesn\'t exist'
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
                    reason: 'was suspended/doesn\'t exist'
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
        if (tweets !== undefined && tweets.length >= 2) {
            req.tweets = tweets;
            gradeArray.sort((a, b) => {
                return a - b;
            });
            let min = Math.floor(ss.minSorted(gradeArray)),
                max = Math.ceil(ss.maxSorted(gradeArray)),
                bins = {},
                ideal = {},
                sampMean = ss.mean(gradeArray),
                sampStdDev = ss.sampleStandardDeviation(gradeArray);

            const getGaussianHeight = (z, mu, sigma) => {
                // gets the height at z given my and sigma
                let gaussianConstant = 1 / Math.sqrt(2 * Math.PI);
                z = (z - mu) / sigma;
                return gaussianConstant * Math.exp(-0.5 * z * z) / sigma;
            };

            for (let i = min; i < max; i++) {
                // give bins all values in range
                bins[i] = 0;
                // directly calculate how tall the height ideally is
                ideal[i] = getGaussianHeight(i, sampMean, sampStdDev) * tweets.length;
            }

            // count how many belong in each bin
            bins = gradeArray.reduce((all, value) => {
                all[Math.floor(value)]++;
                return all;
            }, bins);

            req.stats = {
                count: tweets.length,
                min: min,
                max: max,
                median: ss.medianSorted(gradeArray),
                sampMean: sampMean,
                sampStdDev: sampStdDev,
                bins: JSON.stringify(bins),
                ideal: JSON.stringify(ideal)
            };

            next();
        } else if (tweets.length < 2) {
            Promise.reject().catch(() => {
                res.render('404', {
                    name: req.query.username,
                    reason: `did not tweet enough to have useful statistics (minimum 2, received ${tweets.length})`
                });
            });
        }
    }).catch(err => {
        console.log('[RUNTIME ERROR] ' + err);
        res.render('404', {
            name: req.query.username,
            reason: 'caused something to break'
        });
    });
};

if (production) {
    app.use(enforce.HTTPS({
        trustProtoHeader: true
    }));
}

app.use(minify({
    override: true,
    htmlMinifier: {
        removeComments: true,
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeEmptyAttributes: true,
        minifyJS: true,
        minifyCSS: true,
        quoteCharacter: '"',
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        useShortDoctype: true,
        sortAttributes: true,
        sortClassName: true,
        removeOptionalTags: false
    }
}));
app.use(compression());

app.set('view engine', 'hbs')
    .set('views', './views')
    .get('/', (req, res) => {
        res.render('index', index);
    })
    .get('/user/', getTweetMiddleware, async (req, res) => {
        res.render('user', {
            title: req.query.username + '\'s Tweets',
            tweets: req.tweets,
            stats: req.stats
        });
    })
    .get('/particles.json', (req, res) => {
        res.sendFile(__dirname + '/views/particles.json');
    })
    .listen(port, () => {
        console.log(`Listening on ${port}`);
    });
