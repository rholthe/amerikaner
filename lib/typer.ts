import type { Rolle } from "./scoring";
import type { SpillerStat } from "./stats";

export interface SpillerDto {
  id: number;
  name: string;
  nickname: string | null;
  isActive: boolean;
  givCount: number;
}

export interface ScoreDto {
  playerId: number;
  points: number;
  tricks: number | null;
  role: Rolle;
}

export interface GivDto {
  id: number;
  dealNo: number;
  kind: string;
  bidderId: number | null;
  partnerId: number | null;
  bid: number | null;
  trump: string | null;
  tricksWon: number | null;
  trickCount: number | null;
  isAmerikaner: boolean;
  madeIt: boolean | null;
  note: string | null;
  source: string;
  scores: ScoreDto[];
}

export interface RundeDto {
  id: number;
  gameNo: number;
  targetScore: number;
  winnerId: number | null;
  isFinished: boolean;
  giv: GivDto[];
}

export interface KveldDto {
  id: number;
  date: string;
  place: string;
  isFinished: boolean;
  spillere: { id: number; name: string }[];
  runder: RundeDto[];
}

export interface AktivKveldSvar {
  kveld: KveldDto | null;
  spillere: SpillerDto[];
}

export interface StatistikkSvar {
  spillere: { id: number; name: string }[];
  stat: SpillerStat[];
  kvelder: number;
}
