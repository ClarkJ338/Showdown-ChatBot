/**
 * Fixed Competitive Battle AI
 * Addresses move spamming issues with proper decision variety and context awareness
 */

'use strict';

exports.setup = function () {
	const BattleModule = Object.create(null);
	BattleModule.id = "randomsw";

	// Track recent decisions to prevent spamming
	let recentDecisions = [];
	let turnCount = 0;

	// Simplified but accurate type chart
	const typeChart = {
		'Normal': { 'Rock': 0.5, 'Ghost': 0, 'Steel': 0.5 },
		'Fire': { 'Fire': 0.5, 'Water': 0.5, 'Grass': 2, 'Ice': 2, 'Bug': 2, 'Rock': 0.5, 'Dragon': 0.5, 'Steel': 2 },
		'Water': { 'Fire': 2, 'Water': 0.5, 'Grass': 0.5, 'Ground': 2, 'Rock': 2, 'Dragon': 0.5 },
		'Electric': { 'Water': 2, 'Electric': 0.5, 'Grass': 0.5, 'Ground': 0, 'Flying': 2, 'Dragon': 0.5 },
		'Grass': { 'Fire': 0.5, 'Water': 2, 'Grass': 0.5, 'Poison': 0.5, 'Ground': 2, 'Flying': 0.5, 'Bug': 0.5, 'Rock': 2, 'Dragon': 0.5, 'Steel': 0.5 },
		'Ice': { 'Fire': 0.5, 'Water': 0.5, 'Grass': 2, 'Ice': 0.5, 'Ground': 2, 'Flying': 2, 'Dragon': 2, 'Steel': 0.5 },
		'Fighting': { 'Normal': 2, 'Ice': 2, 'Poison': 0.5, 'Flying': 0.5, 'Psychic': 0.5, 'Bug': 0.5, 'Rock': 2, 'Ghost': 0, 'Dark': 2, 'Steel': 2, 'Fairy': 0.5 },
		'Poison': { 'Grass': 2, 'Poison': 0.5, 'Ground': 0.5, 'Rock': 0.5, 'Ghost': 0.5, 'Steel': 0, 'Fairy': 2 },
		'Ground': { 'Fire': 2, 'Electric': 2, 'Grass': 0.5, 'Poison': 2, 'Flying': 0, 'Bug': 0.5, 'Rock': 2, 'Steel': 2 },
		'Flying': { 'Electric': 0.5, 'Grass': 2, 'Ice': 0.5, 'Fighting': 2, 'Bug': 2, 'Rock': 0.5, 'Steel': 0.5 },
		'Psychic': { 'Fighting': 2, 'Poison': 2, 'Psychic': 0.5, 'Dark': 0, 'Steel': 0.5 },
		'Bug': { 'Fire': 0.5, 'Grass': 2, 'Fighting': 0.5, 'Poison': 0.5, 'Flying': 0.5, 'Psychic': 2, 'Ghost': 0.5, 'Dark': 2, 'Steel': 0.5, 'Fairy': 0.5 },
		'Rock': { 'Normal': 0.5, 'Fire': 2, 'Water': 2, 'Grass': 0.5, 'Ice': 2, 'Fighting': 0.5, 'Poison': 0.5, 'Ground': 0.5, 'Flying': 2, 'Bug': 2, 'Steel': 0.5 },
		'Ghost': { 'Normal': 0, 'Psychic': 2, 'Ghost': 2, 'Dark': 0.5 },
		'Dragon': { 'Dragon': 2, 'Steel': 0.5, 'Fairy': 0 },
		'Dark': { 'Fighting': 0.5, 'Psychic': 2, 'Ghost': 2, 'Dark': 0.5, 'Fairy': 0.5 },
		'Steel': { 'Fire': 0.5, 'Water': 0.5, 'Electric': 0.5, 'Ice': 2, 'Rock': 2, 'Steel': 0.5, 'Fairy': 2 },
		'Fairy': { 'Fire': 0.5, 'Fighting': 2, 'Poison': 0.5, 'Dragon': 2, 'Dark': 2, 'Steel': 0.5 }
	};

	function getTypeEffectiveness(moveType, targetTypes) {
		if (!moveType || !targetTypes) return 1;
		let effectiveness = 1;
		if (typeChart[moveType]) {
			targetTypes.forEach(type => {
				if (typeChart[moveType][type] !== undefined) {
					effectiveness *= typeChart[moveType][type];
				}
			});
		}
		return effectiveness;
	}

	// Anti-spam penalty system
	function getRepetitionPenalty(moveName) {
		if (!moveName) return 1;
		
		const recent = recentDecisions.slice(-3);
		const repetitions = recent.filter(d => d === moveName).length;
		
		// Heavy penalty for spamming the same move
		if (repetitions >= 2) return 0.3; // 70% penalty
		if (repetitions >= 1) return 0.7; // 30% penalty
		return 1; // No penalty
	}

	// Evaluate move with proper context and variety
	function evaluateMove(decision, user, opponent, battle) {
		if (!decision || !decision.move) return 10;
		
		const move = decision.move;
		let score = 30; // Base score

		// Anti-spam system
		const repetitionMultiplier = getRepetitionPenalty(move.name);
		
		// Move category evaluation
		if (move.category === 'Status') {
			// Status moves
			if (move.heal && user.hp < user.maxhp * 0.6) {
				score += 60; // Recovery when hurt
			} else if (move.status && !opponent?.status) {
				score += 40; // Status infliction
			} else if (move.boosts || (move.self && move.self.boosts)) {
				// Setup moves
				if (user.hp > user.maxhp * 0.7) {
					score += 50;
				} else {
					score += 10; // Don't setup when low
				}
			} else if (['stealthrock', 'spikes', 'toxicspikes'].includes(move.id)) {
				score += 35; // Hazards
			} else {
				score += 20; // Other status moves
			}
		} else {
			// Attack moves
			if (move.basePower) {
				// Base power scaling
				score += Math.min(move.basePower * 0.4, 40);
				
				// Type effectiveness
				if (opponent && opponent.types) {
					const effectiveness = getTypeEffectiveness(move.type, opponent.types);
					if (effectiveness > 1) {
						score += 30 * effectiveness;
					} else if (effectiveness < 1) {
						score -= 20 * (1 - effectiveness);
					}
				}
				
				// STAB
				if (user.types && user.types.includes(move.type)) {
					score += 15;
				}
			}
			
			// Priority consideration
			if (move.priority > 0 && user.hp < user.maxhp * 0.4) {
				score += 25;
			}
		}

		// Accuracy penalty
		if (move.accuracy && move.accuracy < 100) {
			score *= (move.accuracy / 100);
		}

		// Apply anti-spam penalty
		score *= repetitionMultiplier;

		// Add variety bonus for different move types
		if (move.category !== 'Status' && repetitionMultiplier === 1) {
			score += 10; // Bonus for move variety
		}

		return Math.max(score, 5);
	}

	// Evaluate switch decisions
	function evaluateSwitch(decision, user, opponent, battle) {
		if (!decision || !decision.pokemon) return 5;
		
		const switchPokemon = decision.pokemon;
		let score = 20; // Base switch score

		// Can't switch to same Pokemon or fainted Pokemon
		if (!switchPokemon || switchPokemon.fainted || switchPokemon === user) {
			return 0;
		}

		// Health consideration
		const hpRatio = switchPokemon.hp / switchPokemon.maxhp;
		score += hpRatio * 30;

		// Don't switch to statused Pokemon unless necessary
		if (switchPokemon.status) {
			score -= 20;
		}

		// Type matchup consideration
		if (opponent && opponent.types && switchPokemon.types) {
			let defensive = 0;
			let offensive = 0;
			
			// Check how well switch resists opponent
			opponent.types.forEach(oppType => {
				switchPokemon.types.forEach(myType => {
					const resistance = getTypeEffectiveness(oppType, [myType]);
					if (resistance < 1) defensive += 15;
					else if (resistance > 1) defensive -= 10;
				});
			});
			
			// Check how well switch hits opponent
			switchPokemon.types.forEach(myType => {
				const effectiveness = getTypeEffectiveness(myType, opponent.types);
				if (effectiveness > 1) offensive += 10;
			});
			
			score += defensive + offensive;
		}

		// Emergency switch bonus
		if (user && user.hp < user.maxhp * 0.25) {
			score += 40;
		}

		// Don't switch unnecessarily when healthy
		if (user && user.hp > user.maxhp * 0.8) {
			score -= 15;
		}

		return Math.max(score, 5);
	}

	// Main decision function with proper variety
	BattleModule.decide = function (battle, decisions) {
		turnCount++;
		
		if (!decisions || decisions.length === 0) return null;

		// Get battle context
		const side = battle?.sides?.find(s => s.currentRequest);
		const user = side?.active?.[0];
		const opponent = battle?.sides?.[1 - side.n]?.active?.[0];

		let evaluatedDecisions = [];

		// Evaluate each decision option
		for (let i = 0; i < decisions.length; i++) {
			const decisionSet = decisions[i];
			let totalScore = 0;

			for (let j = 0; j < decisionSet.length; j++) {
				const decision = decisionSet[j];
				let score = 10; // Default score

				if (decision.type === 'team') {
					score = 5000; // Team preview
				} else if (decision.type === 'move') {
					score = evaluateMove(decision, user, opponent, battle);
				} else if (decision.type === 'switch') {
					score = evaluateSwitch(decision, user, opponent, battle);
				}

				totalScore += score;
			}

			evaluatedDecisions.push({
				index: i,
				score: totalScore,
				decisions: decisionSet
			});
		}

		// Sort by score
		evaluatedDecisions.sort((a, b) => b.score - a.score);

		// Take top 40% of decisions to allow variety
		const topCount = Math.max(1, Math.ceil(evaluatedDecisions.length * 0.4));
		const topDecisions = evaluatedDecisions.slice(0, topCount);

		// Weighted random selection from top decisions
		const weights = topDecisions.map((decision, index) => {
			// Exponential decay: first choice gets most weight, but others still viable
			return Math.pow(0.7, index);
		});

		const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
		let random = Math.random() * totalWeight;

		for (let i = 0; i < topDecisions.length; i++) {
			random -= weights[i];
			if (random <= 0) {
				const chosen = topDecisions[i];
				
				// Track the decision to prevent future spamming
				if (chosen.decisions[0] && chosen.decisions[0].move) {
					recentDecisions.push(chosen.decisions[0].move.name);
					if (recentDecisions.length > 5) {
						recentDecisions.shift();
					}
				}
				
				return chosen.decisions;
			}
		}

		// Fallback to best decision
		const best = evaluatedDecisions[0];
		if (best.decisions[0] && best.decisions[0].move) {
			recentDecisions.push(best.decisions[0].move.name);
			if (recentDecisions.length > 5) {
				recentDecisions.shift();
			}
		}
		
		return best.decisions;
	};

	return BattleModule;
};
