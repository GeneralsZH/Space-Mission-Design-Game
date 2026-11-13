import { useId } from "react";
import type { Build, Language } from "../types";

export default function Satellite({
  build,
  language,
  minimal = false,
}: {
  build: Build;
  language: Language;
  minimal?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const panel = build.moduleIds.find((v) => v.startsWith("panel-"));
  const panelWidth = panel === "panel-l" ? 145 : panel === "panel-s" ? 85 : 120;
  const has = (v: string) => build.moduleIds.includes(v);
  const hga = has("hga-compact") || has("hga-high");
  return (
    <svg
      className={`satellite ${minimal ? "minimal" : ""}`}
      viewBox="0 0 650 470"
      role="img"
      aria-label={
        language === "ru"
          ? "Схема выбранного космического аппарата"
          : "Schematic of the selected spacecraft"
      }
    >
      <defs>
        <linearGradient id={`${id}body`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#cfbea0" />
          <stop offset="0.45" stopColor="#877b63" />
          <stop offset="1" stopColor="#e1cc99" />
        </linearGradient>
        <linearGradient id={`${id}array`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#32628b" />
          <stop offset="1" stopColor="#172f50" />
        </linearGradient>
        <pattern
          id={`${id}cells`}
          width="23"
          height="29"
          patternUnits="userSpaceOnUse"
        >
          <rect width="23" height="29" fill={`url(#${id}array)`} />
          <path
            d="M0 0H23V29H0Z"
            fill="none"
            stroke="#64b6d4"
            strokeOpacity="0.5"
            strokeWidth="0.8"
          />
          <path
            d="M2 14.5H21"
            stroke="#77b4ca"
            strokeOpacity="0.35"
            strokeWidth="0.6"
          />
        </pattern>
        <radialGradient id={`${id}halo`}>
          <stop stopColor="#31d6e5" stopOpacity="0.1" />
          <stop offset="1" stopColor="#31d6e5" stopOpacity="0" />
        </radialGradient>
      </defs>
      {!minimal && (
        <>
          <circle cx="325" cy="240" r="210" fill={`url(#${id}halo)`} />
          <ellipse
            cx="325"
            cy="254"
            rx="241"
            ry="118"
            fill="none"
            stroke="#2c4659"
            strokeDasharray="3 9"
          />
          <ellipse
            cx="325"
            cy="254"
            rx="193"
            ry="188"
            transform="rotate(-30 325 254)"
            fill="none"
            stroke="#1e394c"
          />
          <path
            d="M325 38V68M325 415V438M53 248H85M566 248H596"
            stroke="#507084"
          />
          <circle cx="325" cy="254" r="6" fill="none" stroke="#31d6e5" />
        </>
      )}
      <g
        className="spacecraft-model"
        transform="translate(10 -8) rotate(-12 325 245)"
      >
        {panel && (
          <g>
            <path d="M192 255H452" stroke="#b3bfd1" strokeWidth="9" />
            <path
              d={`M${278 - panelWidth} 186 L278 201 L278 318 L${278 - panelWidth} 303 Z`}
              fill={`url(#${id}cells)`}
              stroke="#6d9bb6"
              strokeWidth="2"
            />
            <path
              d={`M365 202 L${365 + panelWidth} 186 L${365 + panelWidth} 304 L365 319 Z`}
              fill={`url(#${id}cells)`}
              stroke="#6d9bb6"
              strokeWidth="2"
            />
            <path
              d={`M${278 - panelWidth} 186L278 201M365 202L${365 + panelWidth} 186`}
              stroke="#c4d9e4"
              strokeWidth="3"
            />
          </g>
        )}
        {build.moduleIds.some((v) => v.startsWith("bus-")) && (
          <g>
            <path
              d="M278 202L321 181L365 203L365 295L320 321L278 298Z"
              fill={`url(#${id}body)`}
              stroke="#e2cda4"
              strokeWidth="1.5"
            />
            <path
              d="M278 202L321 226L365 203M321 226V321"
              fill="none"
              stroke="#e8d3a9"
              strokeWidth="1.5"
            />
            <path
              d="M285 211L311 227V303L286 291Z"
              fill="#a38f69"
              stroke="#e2cda4"
            />
            <path
              d="M330 234L355 219V285L330 300Z"
              fill="#b6a47f"
              stroke="#6b6357"
            />
            <path
              d="M292 225L305 232M292 238L305 245M292 251L305 258"
              stroke="#4b5151"
              strokeWidth="3"
            />
            {has("radiation") && (
              <path
                d="M278 298L320 321L365 295V285L320 310L278 287Z"
                fill="#9db2c0"
                stroke="#d2dbe0"
              />
            )}
          </g>
        )}
        {hga && (
          <g>
            <path d="M325 190V132" stroke="#c3cbd4" strokeWidth="5" />
            <ellipse
              cx="326"
              cy="125"
              rx={has("hga-high") ? 52 : 39}
              ry="17"
              transform="rotate(-21 326 125)"
              fill="#b7c9d6"
              stroke="#ebf2f5"
              strokeWidth="2"
            />
            <path
              d="M289 138Q325 188 362 111"
              fill="#8296a6"
              stroke="#d7e0e8"
            />
            <path
              d="M325 129L310 93M310 93L294 126M310 93L350 115"
              fill="none"
              stroke="#d0dce4"
              strokeWidth="2"
            />
            <circle cx="310" cy="93" r="3" fill="#31d6e5" />
          </g>
        )}
        {has("lga") && (
          <path
            d="M320 187V118M312 123H328"
            fill="none"
            stroke="#c9d8e2"
            strokeWidth="3"
          />
        )}
        {has("spectrometer") && (
          <g>
            <path
              d="M337 282L358 273L376 290L354 302Z"
              fill="#d3dae0"
              stroke="#7a9daf"
            />
            <ellipse
              cx="365"
              cy="293"
              rx="10"
              ry="8"
              fill="#142c43"
              stroke="#66bed3"
              strokeWidth="2"
            />
          </g>
        )}
        {has("camera") && (
          <g>
            <path
              d="M283 277L298 285V303L283 295Z"
              fill="#192f41"
              stroke="#718b9d"
            />
            <circle cx="290" cy="289" r="5" fill="#52c5d4" />
          </g>
        )}
        {has("radar") && (
          <g>
            <path
              d="M361 261L418 271L419 284L365 278Z"
              fill="#c7d1d9"
              stroke="#eef3f6"
            />
            <path d="M374 265V280M387 268V281M400 270V283" stroke="#647d8c" />
          </g>
        )}
        {has("magnetometer") && (
          <g>
            <path d="M280 244L222 157" stroke="#b8c7d4" strokeWidth="2" />
            <rect x="216" y="147" width="11" height="12" fill="#6ecbd4" />
          </g>
        )}
        {build.moduleIds.some((v) => v.startsWith("engine-")) && (
          <path
            d="M306 315L301 341Q320 352 341 341L335 313"
            fill="#7c8c99"
            stroke="#ccd5dc"
            strokeWidth="2"
          />
        )}
      </g>
      {!minimal && (
        <g fill="#8ba3b5" fontSize="10" fontFamily="monospace">
          <path
            d="M276 169L210 115H112M415 274L490 331H563M323 331V387H420"
            fill="none"
            stroke="#456479"
            strokeWidth="0.8"
          />
          <text x="112" y="105">
            {language === "ru" ? "СИСТЕМА СВЯЗИ" : "COMMUNICATIONS"}
          </text>
          <text x="486" y="348">
            {language === "ru" ? "ЭНЕРГИЯ" : "POWER ARRAY"}
          </text>
          <text x="333" y="404">
            {language === "ru" ? "ДВИГАТЕЛЬНАЯ УСТАНОВКА" : "PROPULSION SYSTEM"}
          </text>
          <circle cx="276" cy="169" r="3" fill="#31d6e5" />
          <circle cx="415" cy="274" r="3" fill="#31d6e5" />
          <circle cx="323" cy="331" r="3" fill="#31d6e5" />
        </g>
      )}
    </svg>
  );
}
