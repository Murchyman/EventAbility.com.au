import { Resvg, type ResvgRenderOptions } from '@resvg/resvg-js';
import type { APIRoute } from 'astro';
import satori from 'satori';
import { html as toReactElement } from 'satori-html';
import type { ReactNode } from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';

const colors = [
  "#FFB8E0", "#FFC6E9", "#FFD0F0", "#E0B8FF", "#EBC9FF",
  "#F0D4FF", "#C9EEFF", "#B8FFE8", "#C5FFE6", "#B8FFD0",
  "#CCFFD9", "#FFE8A0", "#FFF0B8", "#FFD6B8", "#FFE4CC",
  "#FFD0E3", "#FFE2EC", "#E0EBB8", "#E8FFB8", "#B8EBDA", "#CFFFF1"
];

const righteousFont = readFileSync(
  join(process.cwd(), 'public', 'fonts', 'righteous.ttf')
);

const poppinsFont = readFileSync(
  join(process.cwd(), 'public', 'fonts', 'poppins.ttf')
);

const height = 900;
const width = 1200;

// Function to calculate color difference (using a simple RGB distance)
function getColorDifference(color1: string, color2: string) {
  const hex1 = color1.substring(1);
  const hex2 = color2.substring(1);
  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);
  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);
  return Math.sqrt(
    Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2),
  );
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Distribute colors to maximize difference between adjacent colors
function distributeColors(colors: string[]) {
  // Start with a random color
  const shuffledColors = shuffleArray(colors);
  const result: string[] = [shuffledColors[0]];
  const remaining = shuffledColors.slice(1);

  while (remaining.length > 0) {
    const lastColor = result[result.length - 1];
    let maxDiff = -1;
    let bestColorIndex = 0;

    // Add some randomization when differences are similar
    remaining.forEach((color, index) => {
      const diff = getColorDifference(lastColor, color);
      // Add small random factor to break ties and add variety
      const randomFactor = Math.random() * 20;
      if (diff + randomFactor > maxDiff) {
        maxDiff = diff + randomFactor;
        bestColorIndex = index;
      }
    });

    result.push(remaining[bestColorIndex]);
    remaining.splice(bestColorIndex, 1);
  }

  return result;
}

export const GET: APIRoute = async () => {
  const link = 'https://eventability.com.au';
  
  // Use the distributed colors algorithm
  const distributedColors = distributeColors(colors);
  const textLength = "EventAbility".length;
  const textColors = Array.from(
    { length: textLength },
    (_, i) => distributedColors[i % distributedColors.length]
  );

  const html = toReactElement(`
  <div style="background-color: #B8E8FF; display: flex; flex-direction: column; height: 100%; padding: 2rem; width: 100%; justify-content: center;">
    <div style="
      display: flex; 
      background-color: #FFE2EC; 
      border: 3px solid black; 
      border-radius: 12px; 
      padding: 3rem; 
      box-shadow: 7px 7px 0 rgba(0, 0, 0, 1);"
    >
      <div style="display: flex; flex-direction: column; justify-content: center; width: 100%; gap: 2rem;">
        <div style="display: flex; flex-direction: column; gap: 2rem; text-align: center;">  
          <div style="display: flex; justify-content: center; gap: 0.1em;">
            ${
              "EventAbility".split("").map((letter, index) => `
                <span style="
                  font-size: 96px;
                  font-weight: bold;
                  margin: 0;
                  font-family: 'Righteous';
                  color: ${textColors[index]};
                  text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 6px 6px 0 #000;
                  ${letter === ' ' ? 'margin: 0 0.2em;' : ''}
                ">${letter}</span>
              `).join("")
            }
          </div>
          <p style="
            font-size: 48px;
            line-height: 1.2;
            max-width: 800px;
            margin: 0 auto;
            color: #000000;
            font-family: 'Poppins-Bold';
            padding: 0 1rem;
            font-weight: 900;
            letter-spacing: -0.5px;
            tracking-tight: true;
          ">
            Let's be friends!
          </p>
          <br/>
          <p style="
            font-size: 48px;
            line-height: 1.2;
            max-width: 800px;
            margin: 0 auto;
            color: #000000;
            font-family: 'Poppins-ExtraBold';
            padding: 0 1rem;
            font-weight: 1000;
            letter-spacing: -0.5px;
            margin-top: -0.5rem;
            tracking-tight: true;
          ">
            Join our welcoming community.
          </p>
          <br/>
          <p style="
            font-size: 24px;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            color: #000000;
            font-family: 'Poppins';
            padding: 0 1rem;
          ">
            Find friends who understand your journey
                        
          </p>
          <p style="
            font-size: 24px;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            color: #000000;
            font-family: 'Poppins';
            padding: 0 1rem;
          ">
           and share your interests  
          </p>
          <p style="
            font-size: 24px;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            color: #000000;
            font-family: 'Poppins';
            padding: 0 1rem;
          ">
            through accessible,
          </p>
          <p style="
            font-size: 24px;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            color: #000000;
            font-family: 'Poppins';
            padding: 0 1rem;
          ">
            inclusive
                        events.
          </p>

        </div>
      </div>
    </div>
  </div>
  `) as unknown as ReactNode;

  const svg = await satori(html, {
    fonts: [
      {
        name: 'Righteous',
        data: righteousFont,
        style: 'normal',
      },
      {
        name: 'Poppins',
        data: poppinsFont,
        style: 'normal',
      }
    ],
    height,
    width,
  });

  const opts: ResvgRenderOptions = {
    fitTo: {
      mode: 'width',
      value: width,
    },
  };
  const resvg = new Resvg(svg, opts);
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  return new Response(pngBuffer, {
    headers: {
      'content-type': 'image/png',
    },
  });
};
