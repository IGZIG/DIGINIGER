/**
 * Illustration du hero : apprentissage numérique + IA.
 * SVG pur (aucune dépendance, aucun appel réseau) pour rester net à toutes les
 * résolutions et se charger instantanément.
 */
export function HeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-electric-500/20 via-transparent to-gold-500/20 blur-2xl" />
      <svg
        viewBox="0 0 520 440"
        role="img"
        aria-label="Illustration : un apprenant suit un cours en ligne accompagné par un tuteur IA"
        className="relative w-full"
      >
        <defs>
          <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#101B3D" />
            <stop offset="100%" stopColor="#1B2748" />
          </linearGradient>
          <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#5D88FA" />
          </linearGradient>
          <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#FFC44A" />
          </linearGradient>
        </defs>

        {/* Halo */}
        <circle cx="260" cy="210" r="180" fill="#F5F7FB" />

        {/* Écran du cours */}
        <g className="animate-float">
          <rect x="64" y="72" width="300" height="200" rx="18" fill="url(#screen)" />
          <rect x="64" y="72" width="300" height="28" rx="14" fill="#141F3E" />
          <circle cx="84" cy="86" r="4" fill="#F59E0B" />
          <circle cx="98" cy="86" r="4" fill="#4A5C8C" />
          <circle cx="112" cy="86" r="4" fill="#4A5C8C" />

          {/* Lecteur vidéo */}
          <rect x="84" y="116" width="168" height="96" rx="12" fill="#0B1330" />
          <circle cx="168" cy="164" r="20" fill="url(#accent)" opacity="0.9" />
          <path d="M162 155 L180 164 L162 173 Z" fill="#fff" />
          <rect x="84" y="222" width="120" height="6" rx="3" fill="#2563EB" />
          <rect x="204" y="222" width="48" height="6" rx="3" fill="#2B3A63" />

          {/* Progression */}
          <rect x="268" y="116" width="80" height="8" rx="4" fill="#2B3A63" />
          <rect x="268" y="132" width="64" height="8" rx="4" fill="#2B3A63" />
          <rect x="268" y="148" width="72" height="8" rx="4" fill="#2B3A63" />
          <circle cx="308" cy="188" r="26" fill="none" stroke="#2B3A63" strokeWidth="8" />
          <circle
            cx="308"
            cy="188"
            r="26"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="120 200"
            transform="rotate(-90 308 188)"
          />
          <text x="308" y="193" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
            68%
          </text>
        </g>

        {/* Bulle tuteur IA */}
        <g className="animate-float-slow" style={{ animationDelay: "0.8s" }}>
          <rect x="300" y="268" width="184" height="96" rx="20" fill="#fff" stroke="#D8DEED" />
          <circle cx="330" cy="300" r="14" fill="url(#gold)" />
          <path d="M330 293 l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="#fff" />
          <rect x="354" y="292" width="108" height="7" rx="3.5" fill="#D8DEED" />
          <rect x="354" y="306" width="86" height="7" rx="3.5" fill="#EEF1F9" />
          <rect x="318" y="326" width="132" height="7" rx="3.5" fill="#EEF1F9" />
          <rect x="318" y="340" width="96" height="7" rx="3.5" fill="#EEF1F9" />
        </g>

        {/* Carte certificat */}
        <g className="animate-float" style={{ animationDelay: "1.6s" }}>
          <rect x="36" y="286" width="150" height="86" rx="16" fill="#fff" stroke="#D8DEED" />
          <circle cx="66" cy="314" r="12" fill="#EFF4FF" />
          <path d="M60 314 l4 4 8-9" stroke="#2563EB" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <rect x="86" y="308" width="76" height="6" rx="3" fill="#D8DEED" />
          <rect x="86" y="320" width="52" height="6" rx="3" fill="#EEF1F9" />
          <rect x="52" y="342" width="118" height="6" rx="3" fill="#F5F7FB" />
          <rect x="52" y="354" width="76" height="6" rx="3" fill="#F5F7FB" />
        </g>

        {/* Particules */}
        <circle cx="424" cy="112" r="6" fill="#2563EB" opacity="0.5" />
        <circle cx="456" cy="152" r="4" fill="#F59E0B" opacity="0.7" />
        <circle cx="44" cy="176" r="5" fill="#2563EB" opacity="0.35" />
        <circle cx="86" cy="52" r="4" fill="#F59E0B" opacity="0.5" />
      </svg>
    </div>
  );
}
