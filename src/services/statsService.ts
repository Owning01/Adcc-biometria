import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { User } from './db';

/**
 * Calculates comprehensive statistics for all players.
 * @returns {Promise<Object>} Object with userId as key and stats as value.
 */
export const calculateAllStats = async (allUsers: User[] = []) => {
    try {
        const matchesSnapshot = await getDocs(collection(db, 'matches'));
        const tournamentsSnapshot = await getDocs(collection(db, 'tournaments'));

        const tournamentsMap: Record<string, any> = {};
        tournamentsSnapshot.docs.forEach(doc => {
            tournamentsMap[doc.id] = doc.data();
        });

        const playerStats: Record<string, any> = {};

        matchesSnapshot.docs.forEach(matchDoc => {
            const match = matchDoc.data();
            const tournament = tournamentsMap[match.tournamentId] || {};
            const season = tournament.season || 'Unknown';
            const matchDate = new Date(match.date);

            // Process players from both teams
            const processPlayers = (players: any[] | undefined, teamName: string) => {
                if (!players) return;
                players.forEach(p => {
                    const id = p.userId;
                    if (!id) return;

                    const userDoc = allUsers.find(u => u.id === id) || {};
                    const manual = userDoc.manualStats || {};

                    if (!playerStats[id]) {
                        playerStats[id] = {
                            totalGoals: (parseInt(manual.baseGoals) || 0),
                            totalAssists: (parseInt(manual.baseAssists) || 0),
                            seasons: {},
                            clubs: new Set(),
                            firstMatchDate: matchDate,
                            lastMatchDate: matchDate,
                            yearsAdjustment: (parseFloat(manual.yearsAdjustment) || 0)
                        };
                    }

                    const stats = playerStats[id];
                    stats.totalGoals += (parseInt(p.goals) || 0);
                    stats.totalAssists += (parseInt(p.assists) || 0);
                    stats.clubs.add(teamName);

                    if (!stats.seasons[season]) {
                        stats.seasons[season] = { goals: 0, assists: 0 };
                    }
                    stats.seasons[season].goals += (parseInt(p.goals) || 0);
                    stats.seasons[season].assists += (parseInt(p.assists) || 0);

                    if (matchDate < stats.firstMatchDate) stats.firstMatchDate = matchDate;
                    if (matchDate > stats.lastMatchDate) stats.lastMatchDate = matchDate;
                });
            };

            processPlayers(match.playersA, match.teamA?.name);
            processPlayers(match.playersB, match.teamB?.name);
        });

        // Add users who might not have matches but have manual stats
        allUsers.forEach(u => {
            if (!playerStats[u.id] && u.manualStats) {
                const manual = u.manualStats;
                playerStats[u.id] = {
                    totalGoals: (parseInt(manual.baseGoals) || 0),
                    totalAssists: (parseInt(manual.baseAssists) || 0),
                    seasons: {},
                    clubs: [],
                    firstMatchDate: new Date(),
                    lastMatchDate: new Date(),
                    yearsAdjustment: (parseFloat(manual.yearsAdjustment) || 0)
                };
            }
        });

        // Convert Sets to Arrays and calculate time in league
        Object.keys(playerStats).forEach(id => {
            const s = playerStats[id];
            if (!(s.clubs instanceof Array)) s.clubs = Array.from(s.clubs || []);

            const diffTime = Math.abs(new Date().getTime() - s.firstMatchDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const calculatedYears = diffDays / 365;
            const totalYears = calculatedYears + (s.yearsAdjustment || 0);

            s.timeInLeague = totalYears > 1
                ? totalYears.toFixed(1) + ' años'
                : (totalYears * 12).toFixed(1) + ' meses';
        });

        return playerStats;
    } catch (error) {
        console.error("Error calculating stats:", error);
        return {};
    }
};

/**
 * Calculates team statistics: championships and years in league.
 */
export const calculateTeamStats = async () => {
    try {
        const tournamentsSnapshot = await getDocs(collection(db, 'tournaments'));
        const matchesSnapshot = await getDocs(collection(db, 'matches'));
        const teamStats: Record<string, any> = {};

        // Track when teams participated in matches to calculate years in league
        const matches = matchesSnapshot.docs.map(d => d.data());

        tournamentsSnapshot.docs.forEach(doc => {
            const tourney = doc.data();
            const winner = tourney.winner;
            const category = tourney.category || 'General';
            const tournamentId = doc.id;

            // Find teams that played in this tournament
            const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
            const teamsInTourney = new Set();
            tournamentMatches.forEach(m => {
                if (m.teamA?.name) teamsInTourney.add(m.teamA.name);
                if (m.teamB?.name) teamsInTourney.add(m.teamB.name);
            });

            teamsInTourney.forEach(teamName => {
                if (!teamStats[teamName]) {
                    teamStats[teamName] = {
                        championshipsTotal: 0,
                        championshipsByCat: {},
                        firstSeen: new Date(),
                        lastSeen: new Date(0)
                    };
                }

                // Track tournament dates for years in league
                tournamentMatches.forEach(m => {
                    const d = new Date(m.date);
                    if (d < teamStats[teamName].firstSeen) teamStats[teamName].firstSeen = d;
                    if (d > teamStats[teamName].lastSeen) teamStats[teamName].lastSeen = d;
                });
            });

            if (winner) {
                if (!teamStats[winner]) {
                    teamStats[winner] = { championshipsTotal: 0, championshipsByCat: {}, firstSeen: new Date(), lastSeen: new Date() };
                }
                teamStats[winner].championshipsTotal++;
                teamStats[winner].championshipsByCat[category] = (teamStats[winner].championshipsByCat[category] || 0) + 1;
            }
        });

        // Final calculation
        Object.keys(teamStats).forEach(team => {
            const s = teamStats[team];
            const diffTime = Math.abs(new Date().getTime() - s.firstSeen.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            s.yearsInLeague = (diffDays / 365).toFixed(1);
        });

        return teamStats;
    } catch (error) {
        console.error("Error calculating team stats:", error);
        return {};
    }
};
