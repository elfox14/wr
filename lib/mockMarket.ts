import { useState, useEffect } from 'react';

export type PlayerStats = {
  id: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'STR';
  price: number;
  change: number; // percentage change
  rating: number; // out of 10
  history: number[]; // price history for charts
  volume: string;
  country: string;
};

const INITIAL_PLAYERS: PlayerStats[] = [
  // Goalkeepers
  { id: 'gk-1', name: 'Alisson B.', position: 'GK', price: 1500, change: +2.4, rating: 8.5, history: [1400, 1420, 1450, 1480, 1475, 1500], volume: '1.2M', country: 'BR' },
  { id: 'gk-2', name: 'Emi M.', position: 'GK', price: 1200, change: -0.5, rating: 8.0, history: [1250, 1240, 1200, 1220, 1210, 1200], volume: '800K', country: 'AR' },
  { id: 'gk-3', name: 'Thibaut C.', position: 'GK', price: 1800, change: +1.1, rating: 8.8, history: [1700, 1750, 1780, 1790, 1785, 1800], volume: '1.5M', country: 'BE' },
  
  // Defenders
  { id: 'def-1', name: 'Virgil V.D.', position: 'DEF', price: 2100, change: -1.2, rating: 7.8, history: [2200, 2150, 2180, 2120, 2080, 2100], volume: '2.5M', country: 'NL' },
  { id: 'def-2', name: 'Ruben D.', position: 'DEF', price: 2300, change: +3.0, rating: 8.4, history: [2100, 2150, 2200, 2250, 2280, 2300], volume: '3.1M', country: 'PT' },
  { id: 'def-3', name: 'Alphonso D.', position: 'DEF', price: 1950, change: +5.5, rating: 8.1, history: [1800, 1820, 1850, 1900, 1920, 1950], volume: '2.8M', country: 'CA' },
  
  // Midfielders
  { id: 'mid-1', name: 'Kevin D.B.', position: 'MID', price: 3500, change: +5.1, rating: 9.2, history: [3000, 3100, 3300, 3400, 3450, 3500], volume: '4.8M', country: 'BE' },
  { id: 'mid-2', name: 'Jude B.', position: 'MID', price: 3800, change: +8.2, rating: 9.5, history: [3200, 3400, 3500, 3650, 3700, 3800], volume: '6.2M', country: 'EN' },
  { id: 'mid-3', name: 'Pedri', position: 'MID', price: 2800, change: -2.1, rating: 7.9, history: [2900, 2950, 2850, 2820, 2810, 2800], volume: '3.5M', country: 'ES' },
  
  // Strikers
  { id: 'str-1', name: 'Kylian M.', position: 'STR', price: 5000, change: +12.5, rating: 9.8, history: [4200, 4300, 4500, 4800, 4900, 5000], volume: '10.5M', country: 'FR' },
  { id: 'str-2', name: 'Erling H.', position: 'STR', price: 4800, change: +4.3, rating: 9.4, history: [4500, 4600, 4650, 4700, 4750, 4800], volume: '9.2M', country: 'NO' },
  { id: 'str-3', name: 'Leo M.', position: 'STR', price: 5500, change: -1.0, rating: 9.6, history: [5600, 5550, 5580, 5520, 5510, 5500], volume: '15.1M', country: 'AR' },
];

const EVENTS = [
  { message: "Goal Scored!", volatility: 0.15 },
  { message: "Yellow Card!", volatility: -0.05 },
  { message: "Red Card!", volatility: -0.20 },
  { message: "Assist!", volatility: 0.08 },
  { message: "Great Save!", volatility: 0.05 },
  { message: "Missed Penalty!", volatility: -0.15 },
  { message: "Injury Suspected...", volatility: -0.10 }
];

export function useMockMarket() {
  const [players, setPlayers] = useState<PlayerStats[]>(INITIAL_PLAYERS);
  const [latestEvent, setLatestEvent] = useState<{ message: string, targetId: string } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlayers(prevPlayers => {
        // Decide if a major event happens (20% chance per tick)
        const isMajorEvent = Math.random() < 0.2;
        let eventTargetIndex = -1;
        let eventDetails = null;

        if (isMajorEvent) {
          eventTargetIndex = Math.floor(Math.random() * prevPlayers.length);
          eventDetails = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        }

        const newPlayers = prevPlayers.map((p, i) => {
          // Normal random walk volatility (between -2% and +2%)
          let tickVolatility = (Math.random() * 0.04) - 0.02;
          
          if (i === eventTargetIndex && eventDetails) {
            tickVolatility += eventDetails.volatility;
          }

          const newPrice = Math.max(100, Math.round(p.price * (1 + tickVolatility)));
          const newChange = Number((((newPrice - p.history[0]) / p.history[0]) * 100).toFixed(1));
          
          // Randomize rating slightly
          const ratingChange = (Math.random() * 0.4) - 0.2;
          const newRating = Math.min(10, Math.max(1, p.rating + ratingChange));

          const newHistory = [...p.history.slice(1), newPrice];

          return {
            ...p,
            price: newPrice,
            change: newChange,
            rating: Number(newRating.toFixed(1)),
            history: newHistory
          };
        });

        if (isMajorEvent && eventDetails && eventTargetIndex >= 0) {
          setLatestEvent({
            message: `🚨 ${eventDetails.message} ${newPlayers[eventTargetIndex].name}'s stock adjusted!`,
            targetId: newPlayers[eventTargetIndex].id
          });
        } else {
          setLatestEvent(null);
        }

        return newPlayers;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return { players, latestEvent };
}
