import type { SVGProps } from "react";
const paths = {
  home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  folder:
    "M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z",
  compass: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm4-16-2 8-8 2 2-8Z",
  user: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M12 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  search: "m21 21-5-5M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  upload:
    "m8 11 4-4 4 4M12 7v13M7 16H5a4 4 0 0 1-1-8 8 8 0 0 1 15-2 5 5 0 0 1 0 10h-2",
  file: "M14 2H5v20h14V7ZM14 2v6h5M8 13h8M8 17h5",
  image: "M3 3h18v18H3ZM3 17l6-6 4 4 3-3 5 5M16 8h.01",
  camera: "M8 5 10 2h4l2 3h5v16H3V5ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  arrow: "M20 12H4m7-7-7 7 7 7",
  play: "m8 4 12 8-12 8Z",
  pause: "M8 4v16M16 4v16",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  reset: "M3 10a9 9 0 1 1 0 5M3 4v6h6",
  share: "M12 16V2m-5 5 5-5 5 5M5 12H3v9h18v-9h-2",
  bag: "M4 7h16l1 14H3ZM8 8V6a4 4 0 0 1 8 0v2",
  spark: "m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3ZM20 2v4M18 4h4",
  cube: "m12 2 10 5v10l-10 5-10-5V7Zm0 10L2 7m10 5L22 7m-10 5v10M7 4.5l10 5",
  layers: "m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 17l10 5 10-5",
  walk: "M13 5h.01M12 9l-3 5H5m7-5 4 5h4m-8-5 2 8 4 5m-4-5-6 5",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2",
  chevron: "m7 10 5 5 5-5",
  info: "M12 8h.01M12 11v6M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
  undo: "M3 10h10a6 6 0 0 1 0 12M3 10l6-6M3 10l6 6",
  expand: "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5",
};
export type IconName = keyof typeof paths;
export default function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
