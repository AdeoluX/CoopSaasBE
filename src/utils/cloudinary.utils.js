const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_APIKEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadFiles = async (file) => {
    let response;
    await cloudinary.uploader.upload(file, (error, result) => {
        if (error) {
            console.error(error);
        } else {
            response = result
        }
    });
    return response
}

module.exports = {
    uploadFiles
}

