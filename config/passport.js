const passport = require('passport');
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
require('dotenv').config();

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(new LinkedInStrategy({
  clientID: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  callbackURL: process.env.LINKEDIN_CALLBACK_URL,
  scope: ['r_liteprofile', 'w_member_social'],
  state: true
}, (accessToken, refreshToken, profile, done) => {
  console.log('Access Token:', accessToken);
  console.log('Profile:', profile);
  return done(null, { profile, accessToken });
}));

module.exports = passport;
