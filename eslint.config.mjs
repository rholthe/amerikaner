// eslint-config-next 16 eksporterer ferdige flat-configs. FlatCompat-omveien
// som create-next-app genererte krasjer på en sirkulær referanse i
// react-plugin-konfigurasjonen, og trengs uansett ikke lenger.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  { ignores: ["app/generated/**", ".next/**", "node_modules/**"] },
  ...coreWebVitals,
  ...typescript,
];

export default config;
