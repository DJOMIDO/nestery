// src/components/travel/journeyIcon.ts

import { Plane, TrainFront } from "lucide-react";
import type { JourneyKind } from "@/lib/travel";

// The icon for a flight or a train, wherever a journey shows
export const journeyIcon = (kind: JourneyKind) => (kind === "flight" ? Plane : TrainFront);
