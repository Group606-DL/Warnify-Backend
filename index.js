const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const { getVideoDurationInSeconds } = require('get-video-duration')
const app = express();

const port = 8080;
app.use(cors());
app.use(express.json());
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

// client uploads a file
app.post("/upload", function (req, res) {
  console.log("upload:");
  const fileName = Object.keys(req.files)[0];
  const myVideo = req.files[fileName];
  const videoPath = `${__dirname}/videos/${myVideo.name}`
  myVideo
    .mv(videoPath, async (err) => {
      console.log("promise: " + myVideo.name);
      if (err) {
        console.error(err.message);
        res.sendStatus(500);
      } else {
        // TODO: API call to Neta -
        const data = await axios.post("http://10.10.248.106:5000/prediction", {
          videoPath: `videos/${myVideo.name}`
        });
        console.log(data);
        // res.status(200).send(data);
        res.sendStatus(200);
      }
    });
});

// Neta should send here the the json
// body , content
// example: {
//  ....
// }, videoname.mp4 ->  will be saved as videoname.mp4.txt
app.post("/censored", async function (req, res) {
  console.log('got censored req');
  console.log(req.body);
  await fs.writeFile(`${__dirname}/censored/${req.body.name}.txt`, req.body.content);
  res.sendStatus(200);
});

// GET censored files names
app.get("/videos/names", async function (req, res) {
  const videoFiles = await (await fs.readdir(`${__dirname}/videos`)).filter(
      file=> {return path.extname(file).toLowerCase() ==='.mp4'});
  const censoredInfoFiles = await fs.readdir(`${__dirname}/censored`);
  
  let durationsPromises = videoFiles.map(file => {
    return getVideoDurationInSeconds(`${__dirname}/videos/${file}`).then((duration) => {
      return {
        file,
        duration,
        isProcessed: censoredInfoFiles.some(fileName => path.parse(fileName).name === path.parse(file).name)
      }
    })
  })

  Promise.all(durationsPromises).then(filesInfos => {
    res.json(filesInfos);
  })
});

// stream specific censored file
app.get("/stream/:fileName", function (req, res) {
  const decodedFileName = decodeURI(req.params.fileName);
  res.sendFile(`${__dirname}/videos/${decodedFileName}`);
});

app.get("/censoredInfo/:fileName", async function(req,res) {
  const decodedFileName = decodeURI(req.params.fileName);
  const fileNameWithoutExt = path.parse(decodedFileName).name;
  
  try {
    const data = await fs.readFile(`${__dirname}/censored/${fileNameWithoutExt}.json`);
    const dataAsJson = data.toString('utf-8').replace(/'/g, '"');
    
    res.json(dataAsJson)
  } catch (err) {
    res.status(500).send({'error': 'cant find censored file ' + err.toString() }); 
  }
})

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
