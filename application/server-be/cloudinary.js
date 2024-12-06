const { v2: cloudinary } = require('cloudinary')

cloudinary.config({ 
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY, 
    api_secret: process.env.API_SECRET // Click 'View API Keys' above to copy your API secret
});

async function uploadFile(bufferData, options = {}){
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'video', resource_type: 'auto', ...options }, 
            (error, result) => {
                if (error) {
                    reject(error)
                }
                else {
                    resolve(result)
                }
            }
        )
        stream.end(bufferData)
    })
}

async function chunkAndUploadVideo(bufferData, folderName) {
    const chunkSize = 10 * 1024 * 1024; // 10MB
    const chunks = [];

    // Split the video buffer into chunks
    for (let i = 0; i < bufferData.length; i += chunkSize) {
        chunks.push(bufferData.slice(i, i + chunkSize));
    }

    console.log(`Uploading ${chunks.length} chunks to Cloudinary as raw files in folder: ${folderName}`);
    const uploadedChunks = [];

    for (let index = 0; index < chunks.length; index++) {
        try {
            const chunk = chunks[index];
            const result = await uploadFile(chunk, {
                folder: folderName,
                public_id: `chunk_${index + 1}`, // Unique ID for each chunk
                resource_type: "raw", // Treat chunks as raw binary data
            });
            uploadedChunks.push(result.secure_url);
        } catch (error) {
            console.error(`Error uploading chunk ${index + 1}:`, error);
            throw new Error(`Failed to upload chunk ${index + 1}.`);
        }
    }

    return uploadedChunks;
}

module.exports = {
    uploadFile,
    chunkAndUploadVideo
}
