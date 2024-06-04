const express = require('express');
const session = require('express-session');
const axios = require('axios');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

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
    <form action="/auth/linkedin/post" method="post" enctype="multipart/form-data">
      <textarea name="message" placeholder="Enter your message" rows="4" cols="50"></textarea>
      <input type="file" name="image" accept="image/*" />
      <button type="submit">Post to LinkedIn</button>
    </form>
  `);
});

app.post('/auth/linkedin/post', upload.single('image'), async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect('/');
  }

  const accessToken = req.session.accessToken;
  const message = req.body.message;
  const image = req.file;

  try {
    const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const profileId = profileResponse.data.id;
    console.log("this is profile id", profileId)

    let mediaAsset;
    if (image) {
      const imagePath = path.join(__dirname, image.path);
      const imageBuffer = fs.readFileSync(imagePath);
      console.log("I am on image block", accessToken)

      const uploadResponse = await axios.post('https://api.linkedin.com/v2/assets?action=registerUpload', {
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: `urn:li:person:${profileId}`,
          serviceRelationships: [{
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent"
          }]
        }
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const uploadUrl = uploadResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const asset = uploadResponse.data.value.asset;
      console.log("this is assettttttt", asset)

      await axios.post(uploadUrl, imageBuffer, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'image/jpeg'
        }
      });

      mediaAsset = asset;
    }

    const postBody = {
      author: `urn:li:person:${profileId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: message
          },
          shareMediaCategory: mediaAsset ? 'IMAGE' : 'NONE',
          media: mediaAsset ? [{
            status: 'READY',
            description: {
              text: message
            },
            media: mediaAsset,
            title: {
              text: 'Image'
            }
          }] : []
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    await axios.post('https://api.linkedin.com/v2/ugcPosts', postBody, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
      }
    });

    res.send('Post successful!');
  } catch (error) {
    console.error('Error posting to LinkedIn:', error.response ? error.response.data : error.message);
    res.send('Error posting to LinkedIn');
  }
});

app.post('/auth/linkedin/post/business', upload.single('image'), async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect('/');
  }

  const accessToken = req.session.accessToken;
  const message = req.body.message;
  const image = req.file;
  const businessPageId = 'YOUR_BUSINESS_PAGE_ID';  // Replace with your LinkedIn business page ID

  try {
    let mediaAsset;
    if (image) {
      const imagePath = path.join(__dirname, image.path);
      const imageBuffer = fs.readFileSync(imagePath);

      const uploadResponse = await axios.post('https://api.linkedin.com/v2/assets?action=registerUpload', {
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: `urn:li:organization:${businessPageId}`,
          serviceRelationships: [{
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent"
          }]
        }
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const uploadUrl = uploadResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const asset = uploadResponse.data.value.asset;

      await axios.post(uploadUrl, imageBuffer, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'image/jpeg'
        }
      });

      mediaAsset = asset;
    }

    const postBody = {
      author: `urn:li:organization:${businessPageId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: message
          },
          shareMediaCategory: mediaAsset ? 'IMAGE' : 'NONE',
          media: mediaAsset ? [{
            status: 'READY',
            description: {
              text: message
            },
            media: mediaAsset,
            title: {
              text: 'Image'
            }
          }] : []
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    await axios.post('https://api.linkedin.com/v2/ugcPosts', postBody, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
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
