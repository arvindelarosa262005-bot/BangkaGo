import React, { useState, useEffect } from "react";
import { Text, View, Pressable, Image } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MapPin,
  ShieldCheck,
  Users,
  Ship,
  Navigation,
  SlidersHorizontal,
  ArrowUpDown,
  Clock,
} from "lucide-react-native";
import { HarborArt } from "../../src/HarborArt";
import { GisRouteCard, openGisNavigation, resolvePortGis } from "../../src/GisMap";
import { php, tripDate, durationLabel } from "@bangkago/shared";
import { backend, supabase, configured } from "../../src/client";
import { useSession } from "../../src/session";
import {
  Screen,
  Brand,
  Button,
  Field,
  Badge,
  State,
  styles,
  c,
} from "../../src/ui";
export function BoatPhoto({ path }: { path?: string }) {
  const photo = useQuery({
    queryKey: ["photo", path],
    enabled: !!path,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("boat-photos")
        .createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return photo.data ? (
    <Image
      accessibilityLabel="Boat photograph"
      source={{ uri: photo.data }}
      style={styles.image}
    />
  ) : (
    <View
      style={[
        styles.image,
        {
          backgroundColor: c.ice,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      <Ship color="#8eafd4" size={60} strokeWidth={1} />
      <Text style={styles.muted}>Boat photo unavailable</Text>
    </View>
  );
}
export default function Explore() {
  const { profile } = useSession();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [count, setCount] = useState("1");
  const [mode, setMode] = useState("all");
  const [sort, setSort] = useState("recommended");
  const [maxPrice, setMaxPrice] = useState("");
  const [search, setSearch] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [showMap, setShowMap] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem("recent-boats").then((v) =>
      setRecent(v ? JSON.parse(v) : []),
    );
  }, []);
  const trips = useQuery({
    queryKey: ["schedules"],
    enabled: configured,
    queryFn: () => backend.rpc("available_schedules"),
  });
  const all = (trips.data ?? []) as any[];
  const boats = all
    .filter(
      (s) =>
        !search ||
        ((!origin || s.origin.toLowerCase().includes(origin.toLowerCase())) &&
          (!destination ||
            s.destination.toLowerCase().includes(destination.toLowerCase())) &&
          (!date ||
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Manila",
            }).format(new Date(s.starts_at)) === date) &&
          s.remaining >= Number(count) &&
          (mode === "all" || s.mode === mode) &&
          (!maxPrice || s.price_minor <= Number(maxPrice) * 100)),
    )
    .filter((s) => s.remaining > 0)
    .sort((a, b) =>
      sort === "price"
        ? a.price_minor - b.price_minor
        : sort === "capacity"
          ? b.remaining - a.remaining
          : new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  return (
    <Screen>
      <View style={styles.between}>
        <Brand />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => router.push("/(tabs)/profile")}
        >
          <Text style={styles.link}>
            {profile?.display_name.split(" ")[0] ?? "Sign in"}
          </Text>
        </Pressable>
      </View>
      <View
        style={{
          borderRadius: 24,
          overflow: "hidden",
          backgroundColor: c.navy,
        }}
      >
        <View style={styles.hero}>
          <Text
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: "#a9d2ff",
              fontWeight: "700",
            }}
          >
            ABRA DE ILOG & BEYOND
          </Text>
          <Text style={styles.heroTitle}>
            Good journeys
            {"\n"}
            start on the water.
          </Text>
          <Text style={styles.heroText}>Discover a boat. Find your shore.</Text>
        </View>
        <HarborArt height={135} />
      </View>
      <View style={styles.card}>
        <View style={styles.between}>
          <View>
            <Text
              style={{
                fontSize: 9,
                letterSpacing: 1.6,
                color: c.ocean,
                fontWeight: "700",
                marginBottom: 6,
              }}
            >
              PLAN YOUR CROSSING
            </Text>
            <Text style={styles.h2}>Where are we heading?</Text>
          </View>
          <View
            style={{ padding: 10, borderRadius: 12, backgroundColor: c.ice }}
          >
            <Navigation size={21} color={c.ocean} />
          </View>
        </View>
        <Field
          label="Departure"
          icon={<MapPin size={18} color={c.ocean} />}
          placeholder="e.g. Abra de Ilog Port"
          value={origin}
          onChangeText={setOrigin}
          accessory={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Swap departure and destination"
              onPress={() => {
                setOrigin(destination);
                setDestination(origin);
              }}
              style={{ padding: 8 }}
            >
              <ArrowUpDown size={17} color={c.ocean} />
            </Pressable>
          }
        />
        <Field
          label="Destination"
          icon={<Navigation size={18} color={c.ocean} />}
          placeholder="Where would you like to go?"
          value={destination}
          onChangeText={setDestination}
        />
        <View style={styles.row}>
          {["Abra de Ilog Port", "Wawa", "Mamburao"].map((port) => (
            <Pressable
              key={port}
              style={[
                styles.pill,
                { minHeight: 34, paddingVertical: 5, paddingHorizontal: 11 },
                (origin === port || destination === port) && styles.pillSelected,
              ]}
              onPress={() => {
                if (!origin) setOrigin(port);
                else if (!destination && origin !== port) setDestination(port);
                else setOrigin(port);
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", color: c.navy }}>
                {port}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          {[
            ["all", "Any trip"],
            ["seat", "Per seat"],
            ["charter", "Private charter"],
          ].map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: mode === value }}
              aria-checked={mode === value}
              style={[
                styles.pill,
                { minHeight: 36, paddingVertical: 6, paddingHorizontal: 12 },
                mode === value && styles.pillSelected,
              ]}
              onPress={() => setMode(value)}
            >
              <Text style={styles.link}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.between}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: advanced }}
            aria-expanded={advanced}
            onPress={() => setAdvanced(!advanced)}
            style={{
              flexDirection: "row",
              gap: 7,
              alignItems: "center",
              minHeight: 38,
            }}
          >
            <SlidersHorizontal size={15} color={c.ocean} />
            <Text style={styles.link}>
              {advanced ? "Hide date & price filters" : "Date, passengers & price"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle GIS port map"
            onPress={() => setShowMap(!showMap)}
            style={[
              styles.pill,
              { minHeight: 34, paddingVertical: 5, paddingHorizontal: 11 },
              showMap && styles.pillSelected,
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: c.ocean }}>
              {showMap ? "Hide GIS Map" : "📍 GIS Port Map"}
            </Text>
          </Pressable>
        </View>
        {advanced && (
          <View style={{ gap: 10 }}>
            <View style={styles.row}>
              <View style={{ flex: 2 }}>
                <Field
                  label="Trip date (YYYY-MM-DD)"
                  placeholder="Any date"
                  value={date}
                  onChangeText={setDate}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Passengers"
                  keyboardType="number-pad"
                  value={count}
                  onChangeText={setCount}
                />
              </View>
            </View>
            <View style={styles.row}>
              {[
                ["", "Any date"],
                [
                  new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Manila",
                  }).format(new Date()),
                  "Today",
                ],
                [
                  new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Manila",
                  }).format(new Date(Date.now() + 86400000)),
                  "Tomorrow",
                ],
              ].map(([val, label]) => (
                <Pressable
                  key={label}
                  style={[
                    styles.pill,
                    { minHeight: 34, paddingVertical: 5, paddingHorizontal: 11 },
                    date === val && styles.pillSelected,
                  ]}
                  onPress={() => setDate(val)}
                >
                  <Text style={{ fontSize: 11, fontWeight: "600", color: c.ocean }}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Field
              label="Maximum price per seat / charter (PHP)"
              keyboardType="decimal-pad"
              placeholder="Any price"
              value={maxPrice}
              onChangeText={setMaxPrice}
            />
          </View>
        )}
        <Button title="Search boats" onPress={() => setSearch(true)} />
        {Boolean(
          search ||
            origin ||
            destination ||
            date ||
            mode !== "all" ||
            maxPrice,
        ) && (
          <Button
            secondary
            title="Reset filters"
            onPress={() => {
              setOrigin("");
              setDestination("");
              setDate("");
              setCount("1");
              setMode("all");
              setMaxPrice("");
              setSearch(false);
            }}
          />
        )}
      </View>
      {showMap && (
        <GisRouteCard
          originName={origin || "Abra de Ilog Port"}
          destinationName={destination || undefined}
          onSelectPort={(portName) => {
            setOrigin(portName);
            setSearch(true);
          }}
        />
      )}
      {!configured && (
        <View style={styles.card}>
          <Text style={styles.h2}>Getting ready to sail</Text>
          <Text style={styles.subtitle}>
            BangkaGo is awaiting its database connection. Live boats and
            availability will appear after setup.
          </Text>
        </View>
      )}
      <View style={styles.between}>
        <Text style={styles.h2}>
          {search ? "Available journeys" : "Discover your next trip"}
        </Text>
        <Badge value={`${boats.length} trips`} />
      </View>
      <View style={styles.row}>
        {[
          ["recommended", "Earliest trip"],
          ["price", "Lowest price"],
          ["capacity", "Most seats"],
        ].map(([value, label]) => (
          <Pressable
            key={value}
            style={[styles.pill, sort === value && styles.pillSelected]}
            onPress={() => setSort(value)}
          >
            <Text style={styles.muted}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {trips.isFetching && !trips.data ? (
        <State loading />
      ) : trips.error ? (
        <State error={trips.error} retry={() => trips.refetch()} />
      ) : !boats.length ? (
        <State empty="No eligible schedules found. Try another date or destination." />
      ) : (
        boats.map((s) => {
          const gis = resolvePortGis(
            s.origin,
            s.pickup_lat ?? s.origin_lat,
            s.pickup_lng ?? s.origin_lng,
            s.pickup_label,
          );
          return (
            <View key={s.id} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${s.boat_name}`}
                style={{ gap: 10 }}
                onPress={() => router.push(`/boat/${s.id}`)}
              >
                <BoatPhoto path={s.photo_path} />
                <View style={styles.between}>
                  <Text style={styles.h2}>{s.boat_name}</Text>
                  <View style={styles.row}>
                    <Badge
                      value={s.mode === "seat" ? "per seat" : "private charter"}
                    />
                    <ShieldCheck color={c.ocean} size={20} />
                  </View>
                </View>
                <Text style={styles.muted}>
                  Operator: {s.owner_name} · {s.boat_type.replaceAll("_", " ")}
                </Text>
                <View style={styles.row}>
                  <MapPin size={15} color={c.ocean} />
                  <Text style={styles.subtitle}>
                    {s.origin} → {s.destination}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Clock size={14} color={c.muted} />
                  <Text style={styles.muted}>
                    {tripDate(s.starts_at)}
                    {s.ends_at ? ` · ${durationLabel(s.starts_at, s.ends_at)}` : ""}
                  </Text>
                </View>
                <View style={styles.between}>
                  <View>
                    <Text style={styles.price}>{php(s.price_minor)}</Text>
                    <Text style={styles.muted}>
                      {s.mode === "seat" ? "per passenger" : "entire boat"}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Users color={c.muted} size={16} />
                    <Text style={styles.muted}>
                      {s.remaining} of {s.capacity} available
                    </Text>
                  </View>
                </View>
                <Text style={styles.link}>View trip & book →</Text>
              </Pressable>
              <View
                style={{
                  backgroundColor: "#F5F9FF",
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  borderWidth: 1,
                  borderColor: "#DCE9FA",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 11.5, color: c.navy, flex: 1 }}>
                  📍 Pickup: {gis.landmark}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open GPS map for ${s.boat_name}`}
                  onPress={() => openGisNavigation(gis.lat, gis.lng, gis.landmark)}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: c.ocean }}>
                    GPS Map →
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
      {!!recent.length && (
        <>
          <Text style={styles.h2}>Recently viewed</Text>
          {all
            .filter((s) => recent.includes(s.id))
            .slice(0, 3)
            .map((s) => (
              <Button
                secondary
                key={s.id}
                title={`${s.boat_name} · ${s.destination}`}
                onPress={() => router.push(`/boat/${s.id}`)}
              />
            ))}
        </>
      )}
      <FareEstimator />
      <PortSafetyGuide />
      <Text style={styles.muted}>
        Only approved, active boats with valid documents are shown. Seat
        availability is rechecked when you book.
      </Text>
    </Screen>
  );
}
function FareEstimator() {
  const [open, setOpen] = useState(false);
  const [farePhp, setFarePhp] = useState("1500");
  const [groupSize, setGroupSize] = useState("6");
  const totalMinor = Math.max(0, Math.round((Number(farePhp) || 0) * 100));
  const pax = Math.max(1, Math.min(200, Math.round(Number(groupSize) || 1)));
  const perPersonMinor = Math.round(totalMinor / pax);
  return (
    <View style={styles.card}>
      <View style={styles.between}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              color: c.ocean,
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            GROUP & CHARTER PLANNER
          </Text>
          <Text style={styles.h2}>Fare & split calculator</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle fare calculator"
          onPress={() => setOpen(!open)}
          style={[
            styles.pill,
            { minHeight: 38, paddingHorizontal: 13, paddingVertical: 6 },
            open && styles.pillSelected,
          ]}
        >
          <Text style={styles.link}>{open ? "Hide" : "Estimate"}</Text>
        </Pressable>
      </View>
      <Text style={styles.muted}>
        Compare how much each traveller pays when splitting a private bangka
        charter across your group.
      </Text>
      {open && (
        <>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field
                label="Charter or total fare (PHP)"
                keyboardType="decimal-pad"
                value={farePhp}
                onChangeText={setFarePhp}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Passengers sharing"
                keyboardType="number-pad"
                value={groupSize}
                onChangeText={setGroupSize}
              />
            </View>
          </View>
          <View style={styles.row}>
            {[4, 6, 8, 10, 12].map((n) => (
              <Pressable
                key={n}
                style={[
                  styles.pill,
                  { minHeight: 34, paddingHorizontal: 11, paddingVertical: 5 },
                  pax === n && styles.pillSelected,
                ]}
                onPress={() => setGroupSize(String(n))}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: c.navy }}>
                  {n} pax
                </Text>
              </Pressable>
            ))}
          </View>
          <View
            style={{
              backgroundColor: c.ice,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: "#D0E3FA",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View>
              <Text style={styles.muted}>Estimated share per passenger</Text>
              <Text style={styles.price}>{php(perPersonMinor)}</Text>
            </View>
            <Badge value={`${pax} passengers`} />
          </View>
        </>
      )}
    </View>
  );
}
function PortSafetyGuide() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <View style={styles.between}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              color: c.ocean,
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            PASSENGER CHECKLIST
          </Text>
          <Text style={styles.h2}>Port & safety guide</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle port safety guide"
          onPress={() => setOpen(!open)}
          style={[
            styles.pill,
            { minHeight: 38, paddingHorizontal: 13, paddingVertical: 6 },
            open && styles.pillSelected,
          ]}
        >
          <Text style={styles.link}>{open ? "Hide" : "Read guide"}</Text>
        </Pressable>
      </View>
      <Text style={styles.muted}>
        Essential reminders before boarding at Abra de Ilog, Wawa, or Mamburao.
      </Text>
      {open && (
        <View style={{ gap: 10, marginTop: 4 }}>
          {[
            [
              "1. 30-minute reservation hold",
              "Your seat or charter request holds capacity for up to 30 minutes while the boat operator reviews and accepts your trip.",
            ],
            [
              "2. Verified GCash checkout",
              "Pay only inside BangkaGo once your booking moves to Awaiting Payment. Status updates automatically after server verification.",
            ],
            [
              "3. Digital boarding pass at the pier",
              "Open My trips and show your BG-… digital boarding pass to the operator during passenger manifest check-in.",
            ],
            [
              "4. Life jackets & weather advisories",
              "Always wear a life jacket throughout the crossing and follow Philippine Coast Guard and local port weather advisories.",
            ],
          ].map(([title, desc]) => (
            <View
              key={title}
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: "#F7FAFF",
                borderWidth: 1,
                borderColor: c.border,
                gap: 4,
              }}
            >
              <Text style={{ fontWeight: "700", color: c.navy, fontSize: 13 }}>
                {title}
              </Text>
              <Text style={styles.muted}>{desc}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
