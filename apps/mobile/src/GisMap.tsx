import React from "react";
import { View, Text, Pressable, Linking } from "react-native";
import Svg, {
  Rect,
  Path,
  Circle,
  Line,
  G,
  Text as SvgText,
} from "react-native-svg";
import { MapPin, Navigation, Compass } from "lucide-react-native";
import { c, styles, Badge } from "./ui";

export interface GisPort {
  name: string;
  municipality: string;
  lat: number;
  lng: number;
  landmark: string;
}

export const KNOWN_PORTS: Record<string, GisPort> = {
  "Abra de Ilog Port": {
    name: "Abra de Ilog Port",
    municipality: "Abra de Ilog",
    lat: 13.4628,
    lng: 120.7514,
    landmark: "Pier 1–2 Passenger Boarding Ramp, Brgy. Matabang",
  },
  Wawa: {
    name: "Wawa",
    municipality: "Abra de Ilog",
    lat: 13.4712,
    lng: 120.7358,
    landmark: "Wawa Coastal Landing & Boat Mooring Zone",
  },
  Mamburao: {
    name: "Mamburao",
    municipality: "Mamburao",
    lat: 13.2185,
    lng: 120.5936,
    landmark: "Mamburao Municipal Port & Coastal Terminal",
  },
};

export function resolvePortGis(
  portName?: string,
  customLat?: number | null,
  customLng?: number | null,
  customLabel?: string | null,
): GisPort {
  const base =
    (portName && KNOWN_PORTS[portName]) || KNOWN_PORTS["Abra de Ilog Port"];
  return {
    name: portName || base.name,
    municipality: base.municipality,
    lat:
      typeof customLat === "number" && Number.isFinite(customLat)
        ? customLat
        : base.lat,
    lng:
      typeof customLng === "number" && Number.isFinite(customLng)
        ? customLng
        : base.lng,
    landmark:
      customLabel && customLabel.trim().length > 0
        ? customLabel.trim()
        : base.landmark,
  };
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function openGisNavigation(lat: number, lng: number, label?: string) {
  const query = label
    ? `${lat},${lng} (${encodeURIComponent(label)})`
    : `${lat},${lng}`;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&query=${query}`;
  void Linking.openURL(url);
}

// Convert Occidental Mindoro bounding box [lat: 13.16..13.52, lng: 120.53..120.82] into SVG 320x175
function projectPoint(lat: number, lng: number) {
  const minLat = 13.16;
  const maxLat = 13.52;
  const minLng = 120.53;
  const maxLng = 120.82;
  const x = Math.max(
    24,
    Math.min(296, ((lng - minLng) / (maxLng - minLng)) * 272 + 24),
  );
  const y = Math.max(
    22,
    Math.min(153, (1 - (lat - minLat) / (maxLat - minLat)) * 131 + 22),
  );
  return { x, y };
}

export function GisRouteCard({
  originName,
  destinationName,
  pickupLabel,
  pickupLat,
  pickupLng,
  destLat,
  destLng,
  ownerName,
  reminderNote,
  reminderSentAt,
  compact = false,
  onSelectPort,
}: {
  originName?: string;
  destinationName?: string;
  pickupLabel?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
  ownerName?: string;
  reminderNote?: string | null;
  reminderSentAt?: string | null;
  compact?: boolean;
  onSelectPort?: (portName: string) => void;
}) {
  const originGis = resolvePortGis(
    originName,
    pickupLat,
    pickupLng,
    pickupLabel,
  );
  const destGis = destinationName
    ? resolvePortGis(destinationName, destLat, destLng)
    : null;
  const distKm = destGis
    ? haversineKm(originGis.lat, originGis.lng, destGis.lat, destGis.lng)
    : null;
  const distNm = distKm ? distKm * 0.539957 : null;
  const pOrigin = projectPoint(originGis.lat, originGis.lng);
  const pDest = destGis ? projectPoint(destGis.lat, destGis.lng) : null;

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#CBE0FA",
        backgroundColor: "#F5F9FF",
        padding: 15,
        gap: 12,
      }}
    >
      <View style={styles.between}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              color: c.ocean,
              fontWeight: "700",
            }}
          >
            GIS PICKUP & COASTAL RADAR
          </Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.navy }}>
            {originGis.name}
            {destGis ? ` → ${destGis.name}` : " · Boarding Zone"}
          </Text>
        </View>
        {distKm !== null && distNm !== null ? (
          <Badge value={`${distKm.toFixed(1)} km · ${distNm.toFixed(1)} NM`} />
        ) : (
          <Badge value="GPS Active" />
        )}
      </View>

      {!compact && (
        <View
          style={{
            borderRadius: 14,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "#BFD8F7",
            backgroundColor: "#092347",
          }}
        >
          <Svg width="100%" height={165} viewBox="0 0 320 175">
            <Rect x="0" y="0" width="320" height="175" fill="#092347" />
            {/* Lat/Lng GIS grid lines */}
            {[40, 85, 130].map((y) => (
              <Line
                key={`lat-${y}`}
                x1="0"
                y1={y}
                x2="320"
                y2={y}
                stroke="#163B6E"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
            ))}
            {[75, 160, 245].map((x) => (
              <Line
                key={`lng-${x}`}
                x1={x}
                y1="0"
                x2={x}
                y2="175"
                stroke="#163B6E"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
            ))}
            {/* Stylised Mindoro NW coastline polygon */}
            <Path
              d="M 55 175 L 92 140 L 145 105 L 195 52 L 248 44 L 305 60 L 320 95 L 320 175 Z"
              fill="#123A6D"
              stroke="#2864AD"
              strokeWidth="1.5"
            />
            {/* Sea route arc between pickup & destination */}
            {pDest && (
              <Path
                d={`M ${pOrigin.x} ${pOrigin.y} Q ${Math.min(pOrigin.x, pDest.x) - 22} ${(pOrigin.y + pDest.y) / 2 - 18} ${pDest.x} ${pDest.y}`}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2.5"
                strokeDasharray="5,4"
              />
            )}
            {/* All known ports */}
            {Object.values(KNOWN_PORTS).map((port) => {
              const pt = projectPoint(port.lat, port.lng);
              const isOrigin = port.name === originGis.name;
              const isDest = destGis && port.name === destGis.name;
              return (
                <G key={port.name}>
                  {(isOrigin || isDest) && (
                    <Circle
                      cx={pt.x}
                      cy={pt.y}
                      r="11"
                      fill={isOrigin ? "#38BDF833" : "#22C55E33"}
                    />
                  )}
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isOrigin || isDest ? "5.5" : "4"}
                    fill={
                      isOrigin ? "#38BDF8" : isDest ? "#22C55E" : "#93C5FD"
                    }
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  <SvgText
                    x={pt.x + 8}
                    y={pt.y + 4}
                    fill="#E2EEFF"
                    fontSize="9.5"
                    fontWeight="700"
                  >
                    {port.name}
                  </SvgText>
                </G>
              );
            })}
            <SvgText
              x="10"
              y="16"
              fill="#7CC4FA"
              fontSize="8.5"
              fontWeight="700"
            >
              OCCIDENTAL MINDORO COASTAL GIS · WGS84
            </SvgText>
            <SvgText x="10" y="166" fill="#93B4D8" fontSize="8">
              {`PICKUP GPS: ${originGis.lat.toFixed(4)}° N, ${originGis.lng.toFixed(4)}° E`}
            </SvgText>
          </Svg>
        </View>
      )}

      {onSelectPort && (
        <View style={styles.row}>
          {Object.keys(KNOWN_PORTS).map((portName) => (
            <Pressable
              key={portName}
              onPress={() => onSelectPort(portName)}
              style={[
                styles.pill,
                { minHeight: 34, paddingVertical: 5, paddingHorizontal: 11 },
                originGis.name === portName && styles.pillSelected,
              ]}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: c.navy }}>
                📍 {portName}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: c.border,
          gap: 5,
        }}
      >
        <View style={styles.row}>
          <MapPin size={15} color={c.ocean} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: c.navy }}>
            Pickup point: {originGis.landmark}
          </Text>
        </View>
        <View style={styles.row}>
          <Compass size={14} color={c.muted} />
          <Text style={styles.muted}>
            GPS Coordinates: {originGis.lat.toFixed(4)}° N,{" "}
            {originGis.lng.toFixed(4)}° E
            {ownerName ? ` · Operator: ${ownerName}` : ""}
          </Text>
        </View>
        {!!reminderNote && (
          <View
            style={{
              marginTop: 4,
              backgroundColor: "#FFFBEB",
              borderColor: "#FDE68A",
              borderWidth: 1,
              borderRadius: 10,
              padding: 10,
              gap: 3,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400E" }}>
              🔔 Boat Owner Pickup Reminder
              {reminderSentAt ? ` · ${reminderSentAt}` : ""}
            </Text>
            <Text style={{ fontSize: 12, color: "#78350F", lineHeight: 18 }}>
              {reminderNote}
            </Text>
          </View>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open pickup location in Google Maps"
        onPress={() =>
          openGisNavigation(originGis.lat, originGis.lng, originGis.landmark)
        }
        style={({ pressed }) => ({
          minHeight: 42,
          borderRadius: 12,
          backgroundColor: c.ocean,
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Navigation size={15} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }}>
          Open Pickup Location in Google Maps (GPS)
        </Text>
      </Pressable>
    </View>
  );
}

