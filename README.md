# Twitter Grade Stats

[![Build Status](https://travis-ci.org/guppy0130/twitter-grade-stats.svg?branch=master)](https://travis-ci.org/guppy0130/twitter-grade-stats)

A spinoff of an AP Stats project, now personalized!

Express application that takes in a Twitter handle and returns statistics about the Tweets from that account. Currently serves only webpages. Displays a pretty, modern HTML5 canvas chart of grade levels and a superimposed Normal distribution to show how Normal we are.

Thanks to the [jstat/jstat library](https://github.com/jstat/jstat) for Normal distribution calculations.

## Deployment

`npm i` to obtain dependencies. Create an application with Twitter and save API keys to environment variables `TwitterConsumerKey` and `TwitterConsumerSecret`. Use `npm run-script dev` and open `localhost:port` in the browser to ensure the key and secret works.

A functional version of the application exists [here](https://twitter-grade-stats.herokuapp.com).