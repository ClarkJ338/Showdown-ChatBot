/**
 * Competitive Battle AI
 * Advanced decision-making comparable to competitive players:
 * - Damage calculations and 2HKO/OHKO analysis
 * - Hazard management and team synergy
 * - Prediction and mind games
 * - Win condition identification
 * - Speed tiers and priority management
 * - Meta-game awareness
 */

'use strict';

exports.setup = function () {
	const BattleModule = Object.create(null);
	BattleModule.id = "competitive";

	// Store battle history for prediction
	let battleHistory = {
		opponentMoves: [],
		switches: [],
		patterns: new Map()
	};

	// Comprehensive type effectiveness chart
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

	// Calculate type effectiveness with full chart
	function getTypeEffectiveness(moveType, targetTypes) {
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

	// Advanced damage calculation (simplified but competitive-aware)
	function calculateDamage(attacker, defender, move, battle) {
		if (!move.basePower) return 0;

		let power = move.basePower;
		let attackStat = move.category === 'Physical' ? (attacker.stats?.atk || 100) : (attacker.stats?.spa || 100);
		let defenseStat = move.category === 'Physical' ? (defender.stats?.def || 100) : (defender.stats?.spd || 100);

		// STAB
		if (attacker.types?.includes(move.type)) {
			power *= 1.5;
		}

		// Type effectiveness
		const effectiveness = getTypeEffectiveness(move.type, defender.types || ['Normal']);
		power *= effectiveness;

		// Weather, abilities, items would go here in full implementation
		
		// Simplified damage formula
		const level = attacker.level || 50;
		const baseDamage = ((((2 * level / 5 + 2) * power * attackStat / defenseStat) / 50) + 2);
		
		return Math.floor(baseDamage * effectiveness);
	}

	// Check for OHKO/2HKO potential
	function analyzeKOPotential(attacker, defender, moves, battle) {
		if (!moves || !defender.hp) return { ohko: false, twohko: false };

		let maxDamage = 0;
		moves.forEach(move => {
			if (move.category !== 'Status') {
				const damage = calculateDamage(attacker, defender, move, battle);
				maxDamage = Math.max(maxDamage, damage);
			}
		});

		return {
			ohko: maxDamage >= defender.hp,
			twohko: maxDamage >= defender.hp / 2,
			maxDamage
		};
	}

	// Predict opponent's likely moves based on history and situation
	function predictOpponentMoves(opponent, battle) {
		const predictions = [];
		
		// Check recent move patterns
		const recentMoves = battleHistory.opponentMoves.slice(-3);
		const moveFrequency = new Map();
		
		recentMoves.forEach(move => {
			moveFrequency.set(move, (moveFrequency.get(move) || 0) + 1);
		});

		// Situational predictions
		if (opponent.hp < opponent.maxhp * 0.3) {
			predictions.push({ type: 'switch', probability: 0.6, reason: 'low_hp' });
			predictions.push({ type: 'recovery', probability: 0.3, reason: 'low_hp' });
		}

		// Common competitive patterns
		if (opponent.setup) {
			predictions.push({ type: 'setup', probability: 0.4, reason: 'setup_sweeper' });
		}

		return predictions;
	}

	// Evaluate hazard control importance
	function evaluateHazards(battle, side) {
		let hazardPressure = 0;
		const oppSide = battle?.sides?.[1 - side.n];
		
		if (oppSide?.sideConditions) {
			if (oppSide.sideConditions['spikes']) hazardPressure += 20;
			if (oppSide.sideConditions['stealthrock']) hazardPressure += 30;
			if (oppSide.sideConditions['toxicspikes']) hazardPressure += 15;
		}

		return hazardPressure;
	}

	// Identify win conditions and game state
	function analyzeGameState(battle, side) {
		const myTeam = side?.pokemon || [];
		const oppTeam = battle?.sides?.[1 - side.n]?.pokemon || [];
		
		const myAlive = myTeam.filter(p => !p.fainted).length;
		const oppAlive = oppTeam.filter(p => !p.fainted).length;
		
		let gamePhase = 'early';
		if (myAlive <= 3 || oppAlive <= 3) gamePhase = 'mid';
		if (myAlive <= 2 || oppAlive <= 2) gamePhase = 'late';
		if (myAlive <= 1 || oppAlive <= 1) gamePhase = 'endgame';

		// Identify potential win conditions
		const wincons = myTeam.filter(p => 
			!p.fainted && 
			(p.ability === 'Speed Boost' || // Setup sweepers
			 p.moves?.some(m => m.boosts) || // Setup moves
			 p.stats?.spe > 110) // Fast attackers
		);

		return { gamePhase, wincons, teamBalance: myAlive - oppAlive };
	}

	// Advanced move evaluation for competitive play
	function evaluateMoveCompetitive(move, user, target, battle, side) {
		let score = 0;

		if (!move || !target) return score;

		// Base power and type effectiveness
		if (move.category !== 'Status' && move.basePower) {
			const damage = calculateDamage(user, target, move, battle);
			const damagePercent = damage / target.hp;
			
			score += damagePercent * 100; // Damage as percentage
			
			// OHKO bonus
			if (damage >= target.hp) score += 150;
			// 2HKO bonus
			else if (damage >= target.hp / 2) score += 50;
		}

		// Status moves evaluation
		if (move.category === 'Status') {
			// Hazard setting
			if (['Stealth Rock', 'Spikes', 'Toxic Spikes'].includes(move.name)) {
				const hazardValue = evaluateHazards(battle, side);
				score += Math.max(60 - hazardValue, 10);
			}
			
			// Setup moves
			if (move.boosts || move.self?.boosts) {
				const gameState = analyzeGameState(battle, side);
				if (gameState.gamePhase === 'early' && user.hp > user.maxhp * 0.8) {
					score += 70; // High value for setup in early game
				}
			}
			
			// Status infliction
			if (move.status && !target.status) {
				if (move.status === 'par') score += 45; // Paralysis
				if (move.status === 'slp') score += 60; // Sleep
				if (move.status === 'tox') score += 40; // Toxic
				if (move.status === 'brn') score += 35; // Burn
			}
			
			// Recovery
			if (move.heal && user.hp < user.maxhp * 0.6) {
				score += 80;
			}
		}

		// Priority considerations
		if (move.priority > 0) {
			// Check if priority wins the speed tie or revenge kills
			const gameState = analyzeGameState(battle, side);
			if (gameState.gamePhase === 'late' || user.hp < user.maxhp * 0.5) {
				score += 40;
			}
		}

		// Coverage moves (hitting super effective when main type resisted)
		const mainType = user.types?.[0];
		const mainEffectiveness = getTypeEffectiveness(mainType, target.types || ['Normal']);
		const moveEffectiveness = getTypeEffectiveness(move.type, target.types || ['Normal']);
		
		if (mainEffectiveness < 1 && moveEffectiveness > mainEffectiveness) {
			score += 30; // Coverage bonus
		}

		// Prediction and mind games
		const predictions = predictOpponentMoves(target, battle);
		predictions.forEach(pred => {
			if (pred.type === 'switch' && move.category !== 'Status') {
				score += 20 * pred.probability; // Attacking on predicted switch
			}
		});

		// Risk assessment
		if (move.accuracy && move.accuracy < 90) {
			score *= (move.accuracy / 100); // Reduce score for low accuracy
		}

		return Math.max(score, 1);
	}

	// Competitive switch evaluation
	function evaluateSwitchCompetitive(switchPokemon, currentPokemon, opponent, battle, side) {
		let score = 0;

		if (!switchPokemon || switchPokemon.fainted || switchPokemon === currentPokemon) {
			return 0;
		}

		const gameState = analyzeGameState(battle, side);
		
		// HP and status considerations
		const hpRatio = switchPokemon.hp / switchPokemon.maxhp;
		score += hpRatio * 40;
		
		if (switchPokemon.status) score -= 35;

		// Defensive synergy
		if (opponent) {
			// Check if switch resists opponent's likely moves
			const koAnalysis = analyzeKOPotential(opponent, switchPokemon, opponent.moves, battle);
			if (!koAnalysis.ohko) score += 50;
			if (!koAnalysis.twohko) score += 25;
			
			// Offensive pressure
			const offensiveKO = analyzeKOPotential(switchPokemon, opponent, switchPokemon.moves, battle);
			if (offensiveKO.ohko) score += 70;
			if (offensiveKO.twohko) score += 35;
		}

		// Momentum and positioning
		if (currentPokemon.hp < currentPokemon.maxhp * 0.3) {
			score += 60; // Emergency switch
		}
		
		// Speed control
		if (switchPokemon.stats?.spe > (opponent?.stats?.spe || 100)) {
			score += 30; // Speed advantage
		}

		// Win condition alignment
		if (gameState.wincons.includes(switchPokemon)) {
			score += 40; // Preserve win conditions
		}

		// Hazard considerations
		const hazardDamage = evaluateHazards(battle, side);
		score -= hazardDamage * 0.5; // Reduce switching into hazards

		// Late game considerations
		if (gameState.gamePhase === 'late' || gameState.gamePhase === 'endgame') {
			// Be more conservative with switches
			score -= 20;
		}

		return Math.max(score, 1);
	}

	// Track opponent patterns for prediction
	function updateBattleHistory(battle, decision) {
		// This would be called after each turn to learn patterns
		if (decision?.type === 'move') {
			battleHistory.opponentMoves.push(decision.move.name);
			if (battleHistory.opponentMoves.length > 10) {
				battleHistory.opponentMoves.shift();
			}
		}
	}

	// Main decision evaluation
	function getDecisionValue(decision, battle, side) {
		const currentPokemon = side?.active?.[0];
		const opponent = battle?.sides?.[1 - side.n]?.active?.[0];

		if (decision.type === "team") {
			return 5000; // Team preview
		}
		
		if (decision.type === "move") {
			return evaluateMoveCompetitive(decision.move, currentPokemon, opponent, battle, side);
		}
		
		if (decision.type === "switch") {
			return evaluateSwitchCompetitive(decision.pokemon, currentPokemon, opponent, battle, side);
		}
		
		return 15; // Pass/other actions
	}

	// Competitive-level decision making with calculated risks
	BattleModule.decide = function (battle, decisions) {
		if (!decisions || decisions.length === 0) return null;

		const side = battle?.sides?.find(s => s.currentRequest);
		const gameState = analyzeGameState(battle, side);
		
		let dTable = [];
		let maxP = -Infinity;

		// Evaluate each decision
		for (let d = 0; d < decisions.length; d++) {
			let totalScore = 0;
			
			for (let i = 0; i < decisions[d].length; i++) {
				let baseScore = getDecisionValue(decisions[d][i], battle, side);
				
				// Game phase adjustments
				if (gameState.gamePhase === 'late' && decisions[d][i].type === 'move') {
					// More aggressive in late game
					baseScore *= 1.1;
				}
				
				if (gameState.gamePhase === 'endgame') {
					// Risk/reward calculation becomes more important
					if (decisions[d][i].move?.accuracy < 90) {
						baseScore *= 0.9; // Less tolerance for risk
					}
				}
				
				totalScore += baseScore;
			}

			dTable.push({des: d, val: totalScore});
			maxP = Math.max(maxP, totalScore);
		}

		// Competitive players consider top 2-3 moves seriously
		const threshold = maxP * 0.9; // Tighter threshold than casual play
		let topChoices = dTable.filter(d => d.val >= threshold && decisions[d.des]);

		if (topChoices.length === 0) {
			topChoices = dTable.filter(d => d.val === maxP && decisions[d.des]);
		}

		// Weighted selection with slight preference for higher EV
		if (topChoices.length === 1) {
			return decisions[topChoices[0].des];
		}

		// Calculate EV and add small random factor for unpredictability
		const weights = topChoices.map(choice => {
			const normalizedScore = choice.val / maxP;
			return Math.pow(normalizedScore, 3); // Cube to heavily favor best moves
		});
		
		const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
		let random = Math.random() * totalWeight;
		
		for (let i = 0; i < topChoices.length; i++) {
			random -= weights[i];
			if (random <= 0) {
				return decisions[topChoices[i].des];
			}
		}

		return decisions[topChoices[0].des];
	};

	return BattleModule;
};