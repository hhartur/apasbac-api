import { configDotenv } from 'dotenv';
configDotenv()

const env = {
    PORT: process.env.PORT
}

export default env;