// A small hand-built icon set in the minimal-outline style you'd find on
// svgrepo.com (Feather/Tabler-style: 24x24, round strokes). Each icon is
// `currentColor`-based so callers pick the right color per context via a
// text-color className, instead of the flat color emoji always carry.

function Svg({ size = 20, className = "", children, viewBox = "0 0 24 24", ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

const stroke = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

export function HomeIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 11.5 12 4l8 7.5" {...stroke} />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5a2 2 0 0 1 4 0v5h3a1 1 0 0 0 1-1v-9" {...stroke} />
    </Svg>
  );
}

export function UsersIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" {...stroke} />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" {...stroke} />
      <path d="M15.5 5.5a3 3 0 0 1 0 5.8" {...stroke} />
      <path d="M15 14c2.5.3 4.5 2.1 4.5 5" {...stroke} />
    </Svg>
  );
}

export function UserIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.5" {...stroke} />
      <path d="M4.5 19.5c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" {...stroke} />
    </Svg>
  );
}

export function QuestionIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="M9.3 9.3a2.7 2.7 0 1 1 3.9 2.4c-.8.5-1.2 1-1.2 1.9" {...stroke} />
      <circle cx="12" cy="16.7" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function ChatIcon(props) {
  return (
    <Svg {...props}>
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7Z"
        {...stroke}
      />
    </Svg>
  );
}

export function CameraIcon(props) {
  return (
    <Svg {...props}>
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"
        {...stroke}
      />
      <circle cx="12" cy="13" r="3.2" {...stroke} />
    </Svg>
  );
}

export function TrophyIcon(props) {
  return (
    <Svg {...props}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" {...stroke} />
      <path d="M7 5H4.5A1.5 1.5 0 0 0 3 6.5v.5a3.5 3.5 0 0 0 3.5 3.5H7" {...stroke} />
      <path d="M17 5h2.5A1.5 1.5 0 0 1 21 6.5v.5a3.5 3.5 0 0 1-3.5 3.5H17" {...stroke} />
      <path d="M12 14v3.5M9 20.5h6M9.5 20.5c0-1.8.7-2.7 2.5-3 1.8.3 2.5 1.2 2.5 3" {...stroke} />
    </Svg>
  );
}

export function CrystalBallIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="10.5" r="6.5" {...stroke} />
      <path d="M9 8.3c.5-1 1.6-1.6 2.7-1.4" {...stroke} />
      <path d="M6 20.5h12" {...stroke} />
      <path d="M8.5 20.5c.4-1.6 1.8-2.5 3.5-2.5s3.1.9 3.5 2.5" {...stroke} />
    </Svg>
  );
}

export function MapPinIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-6.6 7-11.5A7 7 0 0 0 5 9.5C5 14.4 12 21 12 21Z" {...stroke} />
      <circle cx="12" cy="9.5" r="2.4" {...stroke} />
    </Svg>
  );
}

export function BalloonIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3a5.5 5.5 0 0 1 2.4 10.5c-.5.25-.9.7-.9 1.3v.2a1.5 1.5 0 0 1-3 0v-.2c0-.6-.4-1.05-.9-1.3A5.5 5.5 0 0 1 12 3Z" {...stroke} />
      <path d="M11.3 15.3 10.5 17l1.2 1-1 1.4" {...stroke} />
    </Svg>
  );
}

export function LockIcon(props) {
  return (
    <Svg {...props}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" {...stroke} />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" {...stroke} />
      <circle cx="12" cy="15" r="1.3" fill="currentColor" />
    </Svg>
  );
}

export function BoltIcon(props) {
  return (
    <Svg {...props}>
      <path d="M13 3 6 13.5h5.2L11 21l7-10.5h-5.2L13 3Z" fill="currentColor" />
    </Svg>
  );
}

export function TurtleIcon(props) {
  return (
    <Svg {...props}>
      <path d="M6.5 12a5.5 5.5 0 0 1 11 0v1a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3v-1Z" {...stroke} />
      <circle cx="18" cy="11" r="1.6" {...stroke} />
      <path d="M5 10.5c-.9-.3-1.6.1-1.9 1M5.5 15c-.8.4-1 1.1-.8 1.9" {...stroke} />
      <path d="M9 16.5 8 19M15 16.5l1 2.5" {...stroke} />
    </Svg>
  );
}

export function FireIcon(props) {
  return (
    <Svg {...props}>
      <path
        d="M12 3c1 2.2-.4 3.4-1.4 4.6C9.4 8.9 8.5 10.3 8.5 12a3.5 3.5 0 0 0 7 0c0-1-.4-1.7-.9-2.4.9.5 1.9 1.8 1.9 3.9a4.5 4.5 0 0 1-9 0c0-3.7 2.7-5 4.1-7.5.3-.5.4-1.8.4-3Z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function DiceIcon(props) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3.5" {...stroke} />
      <circle cx="8.3" cy="8.3" r="1.15" fill="currentColor" />
      <circle cx="15.7" cy="8.3" r="1.15" fill="currentColor" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" />
      <circle cx="8.3" cy="15.7" r="1.15" fill="currentColor" />
      <circle cx="15.7" cy="15.7" r="1.15" fill="currentColor" />
    </Svg>
  );
}

export function MoonIcon(props) {
  return (
    <Svg {...props}>
      <path d="M20 14.2A8.3 8.3 0 1 1 9.8 4a6.7 6.7 0 0 0 10.2 10.2Z" {...stroke} />
    </Svg>
  );
}

export function CoinIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" {...stroke} />
      <path d="M14.5 9.2c-.5-.6-1.4-1-2.4-1-1.7 0-3 1.2-3 3s1.3 3 3 3c1 0 1.9-.4 2.4-1" {...stroke} />
      <path d="M8.7 10.3h4M8.7 13.3h4" {...stroke} />
    </Svg>
  );
}

export function CheckIcon(props) {
  return (
    <Svg {...props}>
      <path d="M5 12.5 9.5 17 19 7" {...stroke} strokeWidth={2.2} />
    </Svg>
  );
}

export function CheckCircleIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="M8 12.3 10.8 15 16 9.5" {...stroke} strokeWidth={2} />
    </Svg>
  );
}

export function XIcon(props) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" {...stroke} strokeWidth={2.2} />
    </Svg>
  );
}

export function FrownIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" {...stroke} />
      <circle cx="8.7" cy="10" r="1.1" fill="currentColor" />
      <circle cx="15.3" cy="10" r="1.1" fill="currentColor" />
      <path d="M8.5 16c.9-1.3 2.1-2 3.5-2s2.6.7 3.5 2" {...stroke} />
    </Svg>
  );
}

export function SmileIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" {...stroke} />
      <circle cx="8.7" cy="10" r="1.1" fill="currentColor" />
      <circle cx="15.3" cy="10" r="1.1" fill="currentColor" />
      <path d="M8.3 14.2c.9 1.5 2.2 2.3 3.7 2.3s2.8-.8 3.7-2.3" {...stroke} />
    </Svg>
  );
}

export function TargetIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" {...stroke} />
      <circle cx="12" cy="12" r="5" {...stroke} />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </Svg>
  );
}

export function PartyHornIcon(props) {
  return (
    <Svg {...props} viewBox="0 0 26 26">
      <path d="M4 20 L8 5 Q16 4 21 11 Z" fill="currentColor" />
      <path
        d="M5.4 14.75 9.95 16.85M6.4 11 14.2 14.6"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M4 20 q-2.2 1 -1.6 3.2 q0.6 1.9 2.3 0.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <rect
        x="21.5"
        y="5"
        width="2"
        height="2"
        rx="0.4"
        transform="rotate(20 22.5 6)"
        fill="currentColor"
        opacity="0.85"
      />
      <circle cx="24" cy="9.5" r="1" fill="currentColor" />
      <rect
        x="17.5"
        y="2"
        width="1.6"
        height="1.6"
        rx="0.4"
        transform="rotate(-15 18.3 2.8)"
        fill="currentColor"
        opacity="0.85"
      />
    </Svg>
  );
}

export function SparkleIcon(props) {
  return (
    <Svg {...props}>
      <path
        d="M12 3.5 13.8 9.6 20 11.5 13.8 13.4 12 19.5 10.2 13.4 4 11.5 10.2 9.6 12 3.5Z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function GamepadIcon(props) {
  return (
    <Svg {...props}>
      <path
        d="M7 8h10a4 4 0 0 1 4 4.6l-.5 2.7a2.4 2.4 0 0 1-4.2 1.1L15 15H9l-1.3 1.4a2.4 2.4 0 0 1-4.2-1.1L3 12.6A4 4 0 0 1 7 8Z"
        {...stroke}
      />
      <path d="M8 10.5v3M6.5 12h3" {...stroke} />
      <circle cx="16" cy="10.8" r="0.9" fill="currentColor" />
      <circle cx="18" cy="12.8" r="0.9" fill="currentColor" />
    </Svg>
  );
}

export function MailIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" {...stroke} />
      <path d="M4.5 7 12 12.5 19.5 7" {...stroke} />
    </Svg>
  );
}

export function TimerIcon(props) {
  return (
    <Svg {...props}>
      <path d="M10 3h4" {...stroke} />
      <path d="M12 5.5V4" {...stroke} />
      <circle cx="12" cy="13.5" r="7.5" {...stroke} />
      <path d="M12 9.5V13.5L15 15.5" {...stroke} />
    </Svg>
  );
}

export function HourglassIcon(props) {
  return (
    <Svg {...props}>
      <path d="M7 3.5h10M7 20.5h10" {...stroke} />
      <path d="M7.5 3.5c0 3.3 1.8 5.4 4.5 6.8 2.7-1.4 4.5-3.5 4.5-6.8M7.5 20.5c0-3.3 1.8-5.4 4.5-6.8 2.7 1.4 4.5 3.5 4.5 6.8" {...stroke} />
    </Svg>
  );
}

export function ArrowRightIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" {...stroke} />
    </Svg>
  );
}

export function PinIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3v6.5M8.5 9.5h7l1 4h-9l1-4Z" {...stroke} />
      <path d="M12 13.5V21" {...stroke} />
    </Svg>
  );
}

export function MedalIcon({ tone = "gold", ...props }) {
  const colors = {
    gold: "#f5c04a",
    silver: "#cbd3da",
    bronze: "#c9793f",
  };
  const fill = colors[tone] || colors.gold;
  return (
    <Svg {...props}>
      <path d="M9 3h6l-1.5 5h-3L9 3Z" fill={fill} opacity="0.55" />
      <circle cx="12" cy="14" r="6.5" fill={fill} />
      <circle cx="12" cy="14" r="6.5" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <path d="M12 10.5v7M9.7 12.7 12 10.5l2.3 2.2" stroke="rgba(0,0,0,0.35)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
