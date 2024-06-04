const express = require('express');
const session = require('express-session');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true }));

app.get('/auth/linkedin', (req, res) => {
  const scope = 'profile email openid w_member_social';
  const state = 'SOME_RANDOM_STATE';
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${process.env.LINKEDIN_CALLBACK_URL}&state=${state}&scope=${scope}`;
  res.redirect(authUrl);
});

app.get('/auth/linkedin/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  try {
    const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
      params: {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.LINKEDIN_CALLBACK_URL,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const accessToken = tokenResponse.data.access_token;
    console.log(accessToken)
    req.session.accessToken = accessToken;
    res.redirect('/auth/linkedin/post');
  } catch (error) {
    console.error('Error fetching access token:', error);
    res.send('Error during authentication');
  }
});

app.get('/auth/linkedin/post', (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect('/');
  }
  res.send(`
    <form action="/auth/linkedin/post" method="post">
      <textarea name="message" placeholder="Enter your message" rows="4" cols="50"></textarea>
      <button type="submit">Post to LinkedIn</button>
    </form>
  `);
});

app.post('/auth/linkedin/post', async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect('/');
  }

  const accessToken = req.session.accessToken;
  const message = req.body.message;

  try {
    const profileResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const profileId = profileResponse.data.sub;
    console.log("this is profileid:", profileId)

    await axios.post('https://api.linkedin.com/v2/ugcPosts', {
      author: `urn:li:person:${profileId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: message
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    res.send('Post successful!');
  } catch (error) {
    console.error('Error posting to LinkedIn:', error.response ? error.response.data : error.message);
    res.send('Error posting to LinkedIn');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
