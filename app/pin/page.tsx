import PinSkjema from "@/components/PinSkjema";

export default async function PinSide({
  searchParams,
}: {
  searchParams: Promise<{ neste?: string }>;
}) {
  const { neste } = await searchParams;
  const mål = neste && neste.startsWith("/") ? neste : "/kveld";
  return <PinSkjema neste={mål} />;
}
