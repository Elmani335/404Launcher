/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
const nodeFetch = require('node-fetch')

export class skin2D {
    async creatHeadTexture(data) {
        let image = await getData(data)
        return await new Promise((resolve, reject) => {
            image.addEventListener('load', e => {
                let cvs = document.createElement('canvas');
                cvs.width = 8;
                cvs.height = 8;
                let ctx = cvs.getContext('2d');
                ctx.drawImage(image, 8, 8, 8, 8, 0, 0, 8, 8);
                ctx.drawImage(image, 40, 8, 8, 8, 0, 0, 8, 8);
                return resolve(cvs.toDataURL());
            });
        })
    }
}

async function getData(data) {
    if (data.startsWith('http')) {
        try {
            let response = await nodeFetch(data);
            if (!response.ok) {
                console.error(`Failed to fetch skin data: ${response.status} ${response.statusText}`);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            let buffer = await response.buffer();
            data = `data:image/png;base64,${await buffer.toString('base64')}`;
        } catch (error) {
            console.error('Error fetching skin data:', error);
            // Return a placeholder or default skin data
            data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='; // 1x1 transparent PNG
        }
    }
    let img = new Image();
    img.src = data;
    return img;
}