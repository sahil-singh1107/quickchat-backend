import mongoose from "mongoose";

const connectDB = async() => {
    try {
        const conn = await mongoose.connect(process.env.DATABASE_URL!)
        console.log(`mongo database is connected!!! ${conn.connection.host} `)
    } catch (error) {
        console.error(`Error: ${error} `)
        process.exit(1)
    }
}

export default connectDB