const { api, zadarma_express_handler } = require("zadarma");
const express = require('express')
const log = require('log-to-file');
const app = express()
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());
const PORT = process.env.PORT || 5111;
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const firebase = require('firebase-admin');
const firebaseSrviceAccount = require('./creds.json');
// Initialize Firebase
const firesbaseApp = initializeApp({ credential: cert(firebaseSrviceAccount) });
// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(firesbaseApp);

process.env.ZADARMA_USER_KEY = 'your user key';
process.env.ZADARMA_SECRET_KEY = 'your secret key';

app.post('/zadarma', async (req, res) => {
  if (req.query.zd_echo) return res.send(req.query.zd_echo);  
  const docConfig = db.collection('zadarma').doc('config');
  //check if docConfig.data().datetime is older than 3 minutes
  const docConfigData = await docConfig.get();
  const docConfigDataData = docConfigData.data();
  const docConfigDataDataDatetime = docConfigDataData.datetime;
  const docConfigDataDataDatetimeDate = new Date(docConfigDataDataDatetime.seconds*1000);
  const docConfigDataDataDatetimeDateNow = new Date();
  const docConfigDataDataDatetimeDateNowMinus3Minutes = new Date(docConfigDataDataDatetimeDateNow - 3 * 60 * 1000);
  if (docConfigDataDataDatetimeDate > docConfigDataDataDatetimeDateNowMinus3Minutes) {
    //system is off
    return res.send('');
  }

  if (req.body.called_did==='YOUR_ZADARMA_PHONE_NUMBER') {
    const callerId = parseInt(req.body.caller_id.replace(/\D/g,''));
    const phonesDocRef = db.collection('zadarma').doc('phones');
    const el = await phonesDocRef.get();
    
    //callerId is in the blacklist
    if (el.data().blacklist?.includes(callerId)) return res.json({ "hangup":"1" });

    //callerId is in the whitelist
    if (el.data().whitelist?.includes(callerId)) return res.send('');
    
    if (req.body.event==='NOTIFY_START') {
      return res.json({
        "ivr_play": "ID_OF_YOUR_AUDIO_FILE_UPLOADED_IN_ZADARMA",
        "wait_dtmf": {
          "timeout": 30,
          "attempts": 1,
          "maxdigits": 1,
          "name": "YOUR_ZADARMA_DTMF_SCENARIO_NAME",
          "default": "hangup"
        },
        "language": "en"
      })
    }

    if (req.body.event==='NOTIFY_IVR' && req.body.wait_dtmf.name==='YOUR_ZADARMA_DTMF_SCENARIO_NAME') {
      if (req.body.wait_dtmf.digits==='3') {

        const r = await phonesDocRef.update({
          whitelist: firebase.firestore.FieldValue.arrayUnion(callerId)
        });

        return res.json({
          "redirect":"100"
        })
      } else if (req.body.wait_dtmf.digits) {
        return res.json({
          "hangup":"1"
        })
      }
    } 
  }
  res.send('');
})

app.get('/off', async (req, res) => {
  const docRef = db.collection('zadarma').doc('config');
  const r = await docRef.update({
    datetime: firebase.firestore.FieldValue.serverTimestamp()
  });
  res.send('System is off')
})

app.post('/event', async (req, res) => {
  const docRef = db.collection('zadarma').doc('event');
  const r = await docRef.update({
    events: firebase.firestore.FieldValue.arrayUnion(req.body)
  });
  res.send('Hello event!')
})

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})