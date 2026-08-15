import 'dotenv/config';
export const getCorsOrigin = () => {
    if (process.env.NODE_ENV === 'production') {
        return process.env.FRONTEND_URL; // e.g., 'https://my-live-website.com'
    }
    return 'http://localhost:3000';
};

export default getCorsOrigin;
