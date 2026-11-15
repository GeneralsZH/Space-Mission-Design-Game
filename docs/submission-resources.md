# Space Apps submission — resources actually used

Use the English names in **Link Text**, and copy the full address into **Link URL**. This inventory follows the code, README, installed direct dependencies and the bundled science provenance. NASA data, display assets, educational references and development tools are identified separately.

## NASA Data

| Link Text                                                     | Link URL                                                                                                                                    | Use in this project                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| NASA LRO/LROC — South Pole Time-Weighted Illumination Map     | https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_TWI_SOUTH                                                                           | Observed illumination dataset; the app retains 1,297 sparse samples, not measurements of water ice. |
| NASA PDS / LROC — Original WAC_POLE_ILL_TWI_SOUTH_100M Raster | https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_POLE/WAC_POLE_ILL_TWI_SOUTH/WAC_POLE_ILL_TWI_SOUTH_100M.IMG | Original source raster used by the extraction script; linked as a binary download.                  |
| NASA SVS — CGI Moon Kit                                       | https://svs.gsfc.nasa.gov/4720/                                                                                                             | Lunar colour texture for the 3D Moon; the elevation maps were not imported.                         |
| NASA SVS — Blue Marble                                        | https://svs.gsfc.nasa.gov/2915/                                                                                                             | Earth display mosaic, used for the globe and spaceport map.                                         |
| NASA — Moon Fact Sheet                                        | https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html                                                                               | Lunar physical parameters for the educational orbital model.                                        |
| NASA — Earth Fact Sheet                                       | https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html                                                                              | Mean Earth radius for the surface-scale launch scene.                                               |
| NASA/JPL — Planetary Physical Parameters                      | https://ssd.jpl.nasa.gov/planets/phys_par.html                                                                                              | Reference radii and orbital periods for the solar-system illustration.                              |
| NASA/JPL — Approximate Positions of the Planets               | https://ssd.jpl.nasa.gov/planets/approx_pos.html                                                                                            | Fixed approximate orbital elements for the solar-system illustration.                               |
| NASA Science — Sun Facts                                      | https://science.nasa.gov/sun/facts/                                                                                                         | Reference information for the Sun illustration.                                                     |
| NASA Science — Moon Facts                                     | https://science.nasa.gov/moon/facts/                                                                                                        | Reference information linked from the lunar entry in the solar atlas.                               |
| NASA Glenn — Flight To Orbit                                  | https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/flight-to-orbit/                                                                   | Educational reference for ascent, pitch-over and staging.                                           |
| NASA Basics of Space Flight — Chapter 14: Launch              | https://science.nasa.gov/learn/basics-of-space-flight/chapter14-1/                                                                          | Educational reference for orbital launch and departure sequences.                                   |

## Space Agency Partner & Other Data

| Link Text                                                        | Link URL                                                                                               | Use in this project                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| ESA — Ariane 6                                                   | https://www.esa.int/missions/about-us/directorates/space-transportation/ariane/ariane-6                | Reference dimensions and booster configuration.                                                                    |
| CNES — Ariane 6 Assembly and Launch                              | https://cnes.fr/projets/ariane-6/assemblage-lancement                                                  | Reference information on the Kourou ELA-4 launch complex.                                                          |
| SpaceX — Falcon Payload User's Guide, May 2025                   | https://www.spacex.com/assets/media/falcon-users-guide-2025-05-09.pdf                                  | Reference dimensions, engine/core configurations and launch-pad compatibility; no PDF or artwork is redistributed. |
| Progress Rocket Space Centre — Soyuz-2 Programme                 | https://samspace.ru/about/programs/67/12062/                                                           | Manufacturer reference recorded in the project for the simplified Soyuz-2 representation.                          |
| TsENKI — Ground-Based Space Infrastructure                       | https://www.russian.space/                                                                             | Reference source for launch-site information.                                                                      |
| FAA — Annual Compendium of Commercial Space Transportation: 2013 | https://www.faa.gov/about/office_org/headquarters_offices/ast/media/2014-02-04_FAA_2013_Compendium.pdf | Published February 2014; reference for approximate Soyuz-family dimensions.                                        |
| The Space Devs — Launch Library 2                                | https://thespacedevs.com/llapi                                                                         | Public pad reference coordinates, rounded in the project; API: https://ll.thespacedevs.com/2.3.0/pads/             |
| Speyerer and Robinson (2013) — LROC Illumination Study           | https://doi.org/10.1016/j.icarus.2012.10.010                                                           | Bibliographic reference supplied with the LROC illumination product; the publisher's full text may require access. |

## Software and development tools — include under Other Data/resources

| Link Text                                        | Link URL                                    | Licence or role                                         |
| ------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------- |
| React                                            | https://react.dev/                          | MIT                                                     |
| Three.js                                         | https://threejs.org/                        | MIT                                                     |
| React Three Fiber                                | https://github.com/pmndrs/react-three-fiber | MIT                                                     |
| Vite                                             | https://vite.dev/                           | MIT                                                     |
| TypeScript                                       | https://www.typescriptlang.org/             | Apache-2.0                                              |
| Tailwind CSS                                     | https://tailwindcss.com/                    | MIT                                                     |
| Zustand                                          | https://github.com/pmndrs/zustand           | MIT                                                     |
| Zod                                              | https://zod.dev/                            | MIT                                                     |
| Recharts                                         | https://github.com/recharts/recharts        | MIT                                                     |
| Lucide Icons / lucide-react                      | https://lucide.dev/                         | ISC                                                     |
| Vitest                                           | https://vitest.dev/                         | MIT                                                     |
| Playwright                                       | https://playwright.dev/                     | Apache-2.0                                              |
| Testing Library (React, jest-dom and user-event) | https://testing-library.com/                | MIT                                                     |
| ESLint                                           | https://eslint.org/                         | MIT                                                     |
| TypeScript ESLint                                | https://typescript-eslint.io/               | MIT                                                     |
| Prettier                                         | https://prettier.io/                        | MIT                                                     |
| Node.js                                          | https://nodejs.org/                         | Development runtime                                     |
| npm                                              | https://www.npmjs.com/                      | Package management                                      |
| Python                                           | https://www.python.org/                     | NASA raster extraction script                           |
| Git                                              | https://git-scm.com/                        | Version control                                         |
| GitHub                                           | https://github.com/                         | Repository hosting and collaboration                    |
| OpenAI Codex                                     | https://openai.com/codex/                   | AI-assisted implementation, debugging and documentation |

## Asset credits and scope

- LROC illumination: NASA/GSFC/Arizona State University, LRO/LROC team. See `public/science/provenance.json`. This is historical illumination, not measured ice abundance.
- Moon colour map: NASA Scientific Visualization Studio; LRO LROC/LOLA teams; Ernie Wright. Actual asset: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg
- Blue Marble: NASA/GSFC Scientific Visualization Studio; Reto Stockli; NASA Earth Observatory. Actual asset: https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002915/bluemarble-1024.png
- Rocket shapes, other planetary textures, local terrain, atmosphere and stars are simplified original code geometry/procedural graphics. SpaceX, ESA, CNES and manufacturer references supply factual reference information; their photographs, CAD models and full documents were not imported.
- Licence identifiers above are read from the installed direct software packages. Public access to a reference page is not a blanket permission to redistribute every item on that page. Keep the supplied NASA credits and the software licence notices.
- Codex assistance should be disclosed in the submission's AI-use field if supplied. This project does not claim NASA endorsement.

## Project code

Availability note: the Progress manufacturer URL is recorded in the project, but the automated HTTPS check could not validate its certificate chain. Verify that specific link in a browser before submitting it. The FAA compendium is also listed as a public reference for Soyuz-family dimensions. The paper's DOI is a bibliographic landing page, not a promise of free access to the publisher's full text.

https://github.com/GeneralsZH/Space-Mission-Design-Game/tree/ehso
