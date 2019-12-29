// Global vars
const production = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 3000;

// Dependencies
const twitter = require('twit');
const express = require('express');
const textStatistics = require('text-statistics');
const hbs = require('express-hbs');
const he = require('he');
const ss = require('simple-statistics');
const compression = require('compression');
const minify = require('express-minify-html-2');
const enforce = require('express-sslify');

// set up the express server
let app = express();
let reloader;

// some rendering defaults
let index = {
    deploy: true
};

// we'll also include reload if we're not in prod so we can see changes sooner
if (!production) {
    // eslint-disable-next-line
    const dotenv = require('dotenv').config();
    const reload = require('reload');
    const fs = require('fs');
    index.deploy = false;
    reloader = reload(app);
    fs.watch('./views', { recursive: true }, () => {
        console.log('reloading...');
        reloader.reload();
    });
}

// create a new twitter client
const client = new twitter({
    consumer_key: process.env.TwitterConsumerKey,
    consumer_secret: process.env.TwitterConsumerSecret,
    app_only_auth: true
});

/**
 * we want at most 200 tweets (max), and full tweet (140+)
 * we don't want user objects or retweets
 * we do want replies to other tweets though
 */
const params = {
    count: 200,
    trim_user: true,
    exclude_replies: false,
    include_rts: false,
    tweet_mode: 'extended'
};

/**
 * removes URLs, hashtags, usernames (@'s), and newlines, and appends a period to the cleaned phrase
 * input {string} the string to clean
 */
function cleanText(input) {
    /* eslint-disable */
    const regexURL = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gim,
        regexHash = /\S*#(?:\[[^\]]+\]|\S+)/gim,
        regexUsername = /(^|[^@\w])@(\w{1,15})\b\ /gim,
        regexNewLine = /\n/gim;
    /* eslint-enable */
    let result = he.decode(input.replace(regexURL, '').replace(regexHash, '').replace(regexUsername, '').replace(regexNewLine, '. ').trim() + '.');
    return (result == '.' ? ' ' : result);
}

// and some helper functions
hbs.registerHelper('round', (toRound) => {
    return Math.round(toRound);
});

// the bulk of the calculating.
const getTweetMiddleware = async (req, res, next) => {
    if (req.query.username == '') {
        return res.render('404', {
            name: '',
            reason: 'you didn\'t put in a handle to look up'
        });
    }
    params['screen_name'] = req.query.username;
    let gradeArray = [];
    client.get('statuses/user_timeline', params).then((response) => {
        // log the requested user, the response code, and how many remaining requests in the timeframe
        console.log(`${req.query.username} resulted in a ${response.resp.statusCode} response. Requests remaining: ${response.resp.headers['x-rate-limit-remaining']}`);

        // fail fast: reject the promise, then catch it and render the reason why
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
            // assuming we have the data now since we got back 200
            return response.data.map(element => {
                let cleanedText = cleanText(element.full_text); // clean the tweet text
                let grade = textStatistics(cleanedText).fleschKincaidGradeLevel(); // calculate the grade
                gradeArray.push(grade); // add the grade to the list
                return {
                    id: element.id_str,
                    text: cleanedText,
                    grade: grade
                }; // return a simplified tweet object
            });
        }
    }).then((tweets) => {
        if (tweets !== undefined && tweets.length >= 2) { // we must have > 2 tweets to do math
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

            /**
             * gets the height at z given mu and sigma
             * z {Number} the number of standard deviations from the mean
             * mu {Number} the sample mean
             * sigma {Number} the sample standard deviation
             */
            const getGaussianHeight = (z, mu, sigma) => {
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

            // count how many grades belong in each bin
            bins = gradeArray.reduce((all, value) => {
                all[Math.floor(value)]++;
                return all;
            }, bins);

            // attach a stats object to the request for use later
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
            // we didn't receive enough tweets
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

// if in production, force https requests
if (production) {
    app.use(enforce.HTTPS({
        trustProtoHeader: true
    }));
}

// minify and compress responses
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

const getUrl = (req) => {
    return `${getRoot(req)}${req.originalUrl}`;
};

const getRoot = (req) => {
    return `${req.protocol}://${req.get('host')}`;
};

// setup app routes
app.engine('hbs', hbs.express4({
    partialsDir: `${__dirname}/views/partials`
}));
app.set('view engine', 'hbs');
app.set('views', `${__dirname}/views`);

app.get('/', (req, res) => {
    res.render('index', {
        title: 'Twitter Grade Stats',
        deploy: index.deploy,
        description: 'Find out if your tweets are written at a fifth grader\'s level',
        root: getRoot(req)
    });
});

app.get('/user/', getTweetMiddleware, async (req, res) => {
    res.render('user', {
        title: `${req.query.username}'s Tweets`,
        tweets: req.tweets,
        stats: req.stats,
        deploy: index.deploy,
        url: getUrl(req),
        root: getRoot(req)
    });
});

app.get('/particles.json', (req, res) => {
    res.sendFile(`${__dirname}/views/particles.json`);
});

app.get('/about', (req, res) => {
    res.render('about', {
        title: 'About this project',
        deploy: index.deploy,
        url: getUrl(req),
        root: getRoot(req)
    });
});

app.get('/example.png', (req, res) => {
    res.sendFile(`${__dirname}/views/example.png`);
});

app.get('*', (req, res) => {
    res.status(400).render('404', {
        reason: 'that\'s not a URL we have',
        url: getUrl(req)
    });
});

app.listen(port, () => {
    console.log(`Listening on ${port}`);
});
