/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#2962FF',
                accent: '#2962FF',
                background: '#FFFFFF',
                'text-primary': '#000000',
                link: '#0000EE'
            },
            fontFamily: {
                roboto: ['Roboto', 'sans-serif'],
                ubuntu: ['Ubuntu', 'sans-serif'],
                euclid: ['EuclidCircularSemibold', 'sans-serif'],
            },
            spacing: {
                'base': '4px',
            },
            borderRadius: {
                'DEFAULT': '8px',
            }
        },
    },
    plugins: [],
}
