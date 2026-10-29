/** Original decorative maritime illustration; never used as a boat listing photograph. */
export const harborSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" fill="none">
<defs>
  <linearGradient id="sky" x1="400" y1="0" x2="400" y2="250" gradientUnits="userSpaceOnUse">
    <stop stop-color="#DCEEFF"/>
    <stop offset="0.55" stop-color="#EAF5FF"/>
    <stop offset="1" stop-color="#FFF4E6"/>
  </linearGradient>
  <linearGradient id="sea" x1="400" y1="220" x2="400" y2="420" gradientUnits="userSpaceOnUse">
    <stop stop-color="#2B7CE9"/>
    <stop offset="0.5" stop-color="#1769E0"/>
    <stop offset="1" stop-color="#0B2D59"/>
  </linearGradient>
  <radialGradient id="sun" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(612 92) scale(88)">
    <stop stop-color="#FFFBEB"/>
    <stop offset="0.45" stop-color="#FDE68A" stop-opacity="0.65"/>
    <stop offset="1" stop-color="#FDE68A" stop-opacity="0"/>
  </radialGradient>
</defs>
<path fill="url(#sky)" d="M0 0h800v420H0z"/>
<circle cx="612" cy="92" r="88" fill="url(#sun)"/>
<circle cx="612" cy="92" r="36" fill="#FFFDF7" opacity=".95"/>
<path d="M0 196c70-8 93-90 168-85 60 3 93 78 151 80 76 3 109-56 184-53 69 3 101 56 167 53 51-2 88-26 130-9v111H0Z" fill="#9CC3E8"/>
<path d="M0 217c75-7 117-55 180-52 70 4 103 60 172 50 73-10 98-36 153-27 95 16 183 35 295 3v83H0Z" fill="#6FA3D4"/>
<path d="M174 168h8l3 24h-14l3-24Z" fill="#F8FAFC"/>
<path d="M173 164h10v4h-10z" fill="#DC2626"/>
<circle cx="178" cy="162" r="5" fill="#FDE047" opacity=".85"/>
<path fill="url(#sea)" d="M0 228h800v192H0z"/>
<path d="M0 248c140-22 211 28 350 6s230-8 450 10v42H0Z" fill="#6DB1F3" opacity=".55"/>
<path d="M0 345c125-29 218 18 349 7s245-35 451-5v73H0Z" fill="#082449" opacity=".45"/>
<path d="m498 92 13-4 13 4m-54 20 9-3 9 3m88-26 10-3 10 3" stroke="#5E8DBB" stroke-width="3" stroke-linecap="round"/>
<path d="M0 249c36-20 94-35 160-27 39 4 58 20 69 32-69 2-113 20-171 25L0 270Z" fill="#DDEBEE"/>
<path d="M0 245c51-24 104-28 154-18 26 6 48 14 61 24-72-13-133-2-215 17Z" fill="#B4CDD1"/>
<path d="M72 233c1-39 9-70 19-99" stroke="#3F7297" stroke-width="6" stroke-linecap="round"/>
<path d="M91 137c-19-21-36-21-55-10 22-2 34 3 49 15-26-6-43 0-53 19 20-14 35-14 54-12-6 20-3 33 5 43-1-20 1-32 8-46 16 13 29 19 45 14-19-6-29-13-41-24 23 0 39 7 51 14-13-20-33-25-55-20 11-11 24-16 40-15-21-9-38-4-48 14Z" fill="#467C9E"/>
<path d="m725 240 8-78" stroke="#4D7CA5" stroke-width="5"/>
<path d="M733 163c-22-18-37-12-49 0l41 4c-18 6-27 16-28 29l32-22 13 32-1-36 38 7c-16-16-28-19-38-13 13-11 23-13 34-12-16-9-29-5-42 11Z" fill="#5F8BAF"/>
<ellipse cx="451" cy="326" rx="178" ry="18" fill="#072652" opacity=".32"/>
<path d="m303 284 288-8-39 44c-9 11-169 16-193 2Z" fill="#F9FCFF"/>
<path d="m329 304 239-6-16 22c-9 10-166 16-193 2Z" fill="#D1E7F8"/>
<path d="m303 284 288-8" stroke="#0B2D59" stroke-width="6" stroke-linecap="round"/>
<path d="m376 280 9-64 117-3 24 64" fill="#F6FBFF"/>
<path d="m383 245 121-3 13 32-138 4Z" fill="#B7DAF7"/>
<path d="m385 245 4-29 108-2 8 27Z" fill="#1769E0"/>
<path d="m435 216-3 61m38-62 5 62" stroke="#E9F5FF" stroke-width="5"/>
<path d="m369 214 143-4 9 8-157 5Z" fill="#0B2D59"/>
<path d="m438 211 2-43" stroke="#315D8A" stroke-width="4"/>
<path d="m443 169 40 12-41 10" fill="#F59E0B"/>
<path d="m351 289-49 43m235-50 49 40m-282 7 285-5" stroke="#C7E4FA" stroke-width="5" stroke-linecap="round"/>
<path d="m285 334 315-9" stroke="#F8FCFF" stroke-width="8" stroke-linecap="round"/>
<path d="m395 290 91-3" stroke="#1769E0" stroke-width="4" stroke-linecap="round"/>
<path d="M184 307h74m347-14h60M93 358h76m425 17h84M358 371h98m-11-116h-8" stroke="#BFDEFA" stroke-width="3" stroke-linecap="round" opacity=".65"/>
</svg>`;
export const harborDataUri =
  "data:image/svg+xml;utf8," + encodeURIComponent(harborSvg);
