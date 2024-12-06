const express = require("express");
const { connectDatabase } = require("./dbConnection");
const { uploadFile, chunkAndUploadVideo } = require("./cloudinary");
const User = require("./user");
const Movie = require("./movie");
const bodyParser = require("body-parser");
const fileUploadMiddleWare = require("express-fileupload");
const bcryptjs = require("bcryptjs");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const transporter = require("./utils/sendEmail").transporter;

require("dotenv").config();

const server = express();
const PORT = 1337;

// server.use(bodyParser())
server.use(cors());
server.use(express.json());
server.use(fileUploadMiddleWare());

server.post("/signup", async (request, response, next) => {
  try {
    const { username, email, password } = request.body;

    const existingUser = await User.find({ email });

    if (existingUser.length > 0) {
      response.status(400).json({ message: "User already exists" });
      return;
    }
    const hashedPassword = await bcryptjs.hash(password, 10);

    const otp = Math.random() * 10000;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "",
      text: `Your OTP is ${otp.toFixed()}`,
    });

    const user = new User({
      username,
      email,
      password: hashedPassword,
      isVerified: false,
      otp: otp.toFixed(),
    });

    const newUser = await user.save();

    const token = jwt.sign(
      {
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
      process.env.JWT_SECRET
    );

    response.status(200).json({
      message: "Sign Up successful",
      data: newUser,
      token,
    });
  } catch (error) {
    console.log({ error });
  }
});

server.post("/signin", async (request, response, next) => {
  try {
    const { email, password } = request.body;

    const user = await User.findOne({ email }).lean();

    if (!user) {
      response.status(400).json({ messege: "dekh ke daal na bhai" });
    }
    const isPasswordMatched = await bcryptjs.compare(password, user.password);
    console.log({
      isPasswordMatched,
    });
    if (!isPasswordMatched) {
      response.status(400).json({ message: "password galat hai dekh ke daal" });
    }

    const token = jwt.sign({ ...user }, process.env.JWT_SECRET);

    response.status(200).json({
      message: "chalu hogya congrats",
      data: user,
      token,
    });
  } catch (error) {
    console.log({ error });
  }
});

server.get("/getUser", (request, response, next) => {
  const user = jwt.verify(
    request.headers.authorization,
    process.env.JWT_SECRET
  );
});

server.post("/insert-movie", async (request, response, next) => {
  try {
    // Validate required fields
    if (!request.body.name || !request.body.description || !request.files) {
      return response.status(400).json({
        message: "Missing required fields: name, description, or files.",
      });
    }

    const { image, video } = request.files;

    // Validate image and video existence
    if (!image || !video) {
      return response
        .status(400)
        .json({ message: "Image and video files are required." });
    }

    // Validate file types
    if (!image.mimetype.startsWith("image/")) {
      return response.status(400).json({ message: "Invalid image file type." });
    }
    if (!video.mimetype.startsWith("video/")) {
      return response.status(400).json({ message: "Invalid video file type." });
    }

    // Validate file sizes
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
    // const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
    if (image.size > MAX_IMAGE_SIZE) {
      return response
        .status(400)
        .json({ message: "Image file size exceeds the 5MB limit." });
    }
    // if (video.size > MAX_VIDEO_SIZE) {
    //     return response.status(400).json({ message: "Video file size exceeds the 500MB limit." });
    // }

    // Upload thumbnail
    const imageUpload = await uploadFile(image.data);

    // Process video file
    const videoBuffer = video.data;
    const folderName = `videos/${request.body.name.replace(/\s+/g, "_")}`;
    let videoUrls;

    if (videoBuffer.length > 10 * 1024 * 1024) {
      // Chunk and upload video if size > 10MB
      videoUrls = await chunkAndUploadVideo(videoBuffer, folderName);
    } else {
      // Upload as a single file
      const singleUpload = await uploadFile(videoBuffer, {
        folder: folderName,
      });
      videoUrls = [singleUpload.secure_url];
    }

    // Save movie data to the database
    const movieData = new Movie({
      movieName: request.body.name,
      movieDescription: request.body.description,
      thumbnailUrl: imageUpload.secure_url,
      movieUrl: videoUrls.join(","), // Store as a comma-separated string
    });
    await movieData.save();

    response.status(201).json({ message: "Movie uploaded successfully." });
  } catch (error) {
    console.error("Error uploading movie:", error);
    response
      .status(500)
      .json({ message: "Internal server error.", error: error.message });
  }
});

server.get("/movies", async (req, res, next) => {
  const movieData = await Movie.find();
  res.status(200).json({ data: movieData });
});

server.post("/verifyOtp", async (req, res, next) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email });

  const token = jwt.sign({ ...user }, process.env.JWT_SECRET);

  if (otp === user?.otp) {
    res.status(200).json({ message: "OTP Verified", data: user, token });
  } else {
    res.status(403).json({ data: "Invalid OTP" });
  }
});

connectDatabase();
server.listen(PORT, () => {
  console.log("server is listening on port 1337");
});
