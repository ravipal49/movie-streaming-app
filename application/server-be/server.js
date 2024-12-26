const express = require("express");
const { connectDatabase } = require("./dbConnection");
const { uploadFile, chunkAndUploadVideo } = require("./cloudinary");
const User = require("./user");
const Movie = require("./movie");
const bodyParser = require("body-parser");
const fileUploadMiddleWare = require("express-fileupload");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const transporter = require("./utils/sendEmail").transporter;
const cors = require("cors");
const razorpay = require("./razorpayConfig").razorpay;
const Transaction = require("./transactionSchema");
const crypto = require("crypto");

require("dotenv").config();

const server = express();
const PORT = 1337;

server.use(cors());

// server.use(bodyParser())
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
      isPaid: request.body.isPaid ? Boolean(request.body.isPaid) : true,
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

server.post("/create-payment", async (req, res, next) => {
  const { userId, amount } = req.body;


  try {
    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: "receipt_" + new Date().getTime().toString(),
      payment_capture: 1,
    };
    const order = await razorpay.orders.create(options);

    const transaction = new Transaction({
      userId: userId,
      razorpayOrderId: order.id,
      amount: amount,
      isSubscriptionPurchase: true,
    });
    await transaction.save();
    res.json({ orderId: order.id, amount: amount, currency: "INR" });
  } catch (e) {
    console.log(e);
  }
});

server.post("/verify-subscription-payment", async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      userId,
    } = req.body;

    const transaction = await Transaction.findOne({
      razorpayOrderId: razorpay_order_id,
    });
    if (!transaction) return res.status(400).send("Invalid order_id");

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature === razorpay_signature) {
      transaction.status = "paid";
      transaction.razorpayPaymentId = razorpay_payment_id;
      transaction.razorpaySignature = razorpay_signature;
      await transaction.save();

      const user = await User.findById(userId);
      user.isSubscribed = true;
      user.subcriptionValidTill = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ); // Example: 30 days
      await user.save();

      res
        .status(200)
        .send({ message: "Payment verified and subscription activated." });
    } else {
      res
        .status(400)
        .send({ message: "Invalid signature, payment not verified." });
    }
  } catch (error) {
    console.log({ error });
  }
});


server.post("/razorpay-webhook", async (req, res) => {
  const secret = process.env.RAZORPAY_SECRET;

// Generate HMAC digest
const shasum = crypto.createHmac("sha256", secret);
shasum.update(JSON.stringify(req.body));
const digest = shasum.digest("hex");

// Verify signature
if (digest === req.headers["x-razorpay-signature"]) {
  const { event, payload } = req.body;

  // Handle payment authorized
  if (event === "payment.authorized") {
    // Handle payment authorized logic (if any)
  }

  // Handle payment captured
  else if (event === "payment.captured") {
    const orderId = payload.payment.entity.order_id;
    const razorpayPaymentId = payload.payment.entity.id;

    const transaction = await Transaction.findOne({ razorpayOrderId: orderId });
    if (transaction) {
      transaction.status = "paid";
      transaction.razorpayPaymentId = razorpayPaymentId;
      await transaction.save();

      if (transaction.isSubscriptionPurchase) {
        const user = await User.findById(transaction.userId);
        if (user) {
          user.isSubscribed = true;
          user.subcriptionValidTill = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Add 30 days
          await user.save();
        }
      }
    }
  }

  // Send success response
  return res.status(200).json({ status: "ok" });
} else {
  // Invalid signature response
  return res.status(400).json({ message: "Invalid signature." });
}
});


connectDatabase();
server.listen(PORT, () => {
  console.log("server is listening on port 1337");
});