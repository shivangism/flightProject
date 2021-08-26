//jshint esversion:6
require('dotenv').config()
const express = require("express");
const ejs = require("ejs");
// const bcrypt = require('bcrypt');
const expressSession = require('express-session');
const passport = require('passport');
const session = require('express-session')
const passportLocalMongoose = require('passport-local-mongoose')
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
// var findOrCreate = require('mongoose-findorcreate');

const app = express();
app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(function (req, res, next) {
    res.locals.currentUser = req.user;
    next();
})


const mongoose = require('mongoose');
const { use } = require("passport");
const { env } = require('process');
mongoose.connect('mongodb+srv://shivangism:'+process.env.DBPASSWORD+'@cluster0.qjm1u.mongodb.net/flightDb?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })

const userSchema = new mongoose.Schema({
    name: String,
    password: String,
    username: String,//email
    flight_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Flight' }]
    // googleId:String,
})
userSchema.plugin(passportLocalMongoose);
// userSchema.plugin(findOrCreate);

const User = new mongoose.model('User', userSchema);

const flightsSchema = new mongoose.Schema({
    from: String,
    to: String,
    from_code: String,
    to_code: String,
    user_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
})

const Flight = new mongoose.model('Flight', flightsSchema)
passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

// passport.use(new GoogleStrategy({
//     clientID:CLINTID,
//     clientSecret: CLIENTSECRET,
//     callbackURL: "http://localhost:3000/auth/google/secrets",
//     userProfileURL:'https://www.googleapis.com/oauth2/v3/userinfo'
// },
//     function (accessToken, refreshToken, profile, cb) {
//         console.log(profile);
//         User.findOrCreate({ googleId: profile.id }, function (err, user) {
//             return cb(err, user);
//         });
//     }
// ));
app.get('/', function (req, res) {
    res.render('home.ejs')
})
app.get('/register', function (req, res) {
    res.render('register.ejs');
})
app.post('/register', function (req, res) {
    User.register({ username: req.body.username, name: req.body.name, flight_ids: [] }, req.body.password, function (err, user) {
        if (err) { console.log(err) }
        passport.authenticate('local')(req, res, function () {
            res.redirect('/user');
        })

    })
})


app.get('/login', function (req, res) {
    res.render('login.ejs');
})
app.post('/login', function (req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    })
    req.login(user, function (err) {
        if (err) {
            console.log(err)
            res.redirect('/login');

        }
        else {
            passport.authenticate('local')(req, res, function () {
                res.redirect('/user');
            })
        }
    })
})

app.get('/user', function (req, res) {
    if (req.isAuthenticated) {
        current_user_id = req.session.passport.user
        User.findOne({ _id: current_user_id }).populate('flight_ids').exec(function (err, user) {
            res.render('user.ejs', { user: user })
        })

    }
    else { res.redirect('/login') }
})


app.get('/logout', function (req, res) {
    req.logOut();
    res.redirect('/');
})


app.post('/add', function (req, res) {
    if (req.isAuthenticated) {
        Flight.findOne({ from: req.body.from, to: req.body.to }, function (err, flight) {
            if (flight) {
                User.updateOne({ _id: req.body.id }, { $addToSet: { flight_ids: flight._id } }, (err, value) => {
                    Flight.updateOne({ _id: flight.id }, { $addToSet: { user_ids: req.body.id } }, (err, value) => {
                        res.redirect('/user');
                    })
                })


            }
            else {
                const new_flight = new Flight({
                    from: req.body.from,
                    to: req.body.to,
                    user_ids: req.body.id

                });
                new_flight.save((err, newFlight) => {
                    User.updateOne({ _id: req.body.id }, { $addToSet: { flight_ids: newFlight._id } }, (err, value) => {
                        res.redirect('/user')
                    })
                });

            }


        })

    }
})
app.get('/delete/:id', function (req, res) {
    if (req.isAuthenticated) {
        current_user_id = req.session.passport.user;
        User.updateOne({ _id: current_user_id }, { '$pull': { flight_ids: req.params.id } }, function (err, user) {
            Flight.updateOne({ _id: req.params.id }, { '$pull': { user_ids: current_user_id } }, function (err) {
             
                Flight.findOne({_id: req.params.id },function(err,flight){
                    if (flight.user_ids.length === 0) {
                        Flight.deleteOne({ _id: req.params.id }, function (err) {
                          if(err){  console.log(err)}
                          else{
                            res.redirect('/user')}
                        });
                    }
                    else { 
                        res.redirect('/user')
                     }
                })
               
            })
        })

    }
})

// console.log('yes')
app.listen(process.env.PORT || 3000 , function () { console.log('server running on 3000') })


