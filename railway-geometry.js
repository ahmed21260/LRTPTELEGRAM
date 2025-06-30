const fs = require('fs');
const path = require('path');

class RailwayGeometry {
  constructor() {
    this.railwayLines = new Map(); // Map des lignes ferroviaires par ID
    this.loadRailwayData();
  }

  // Charger les données ferroviaires (GeoJSON ou données SNCF)
  loadRailwayData() {
    try {
      // Pour l'instant, on utilise des données de test
      // En production, cela viendrait d'une API SNCF ou d'un fichier GeoJSON
      this.railwayLines.set('LIGNE_PARIS_LYON', {
        id: 'LIGNE_PARIS_LYON',
        name: 'Ligne Paris-Lyon',
        geometry: [
          [2.3522, 48.8566], // Paris
          [2.2945, 48.8584], // Paris Gare de Lyon
          [2.3186, 48.8447], // Paris Bercy
          [2.4567, 48.8234], // Melun
          [2.7890, 48.7123], // Sens
          [3.0578, 48.6234], // Laroche-Migennes
          [3.4567, 48.5234], // Dijon
          [4.0567, 48.3234], // Chalon-sur-Saône
          [4.4567, 48.1234], // Mâcon
          [4.8567, 47.9234], // Villefranche-sur-Saône
          [4.8234, 45.7640]  // Lyon Part-Dieu
        ],
        pkStart: 0,
        pkEnd: 465.2, // 465.2 km
        direction: 'Paris → Lyon'
      });

      this.railwayLines.set('LIGNE_LYON_MARSEILLE', {
        id: 'LIGNE_LYON_MARSEILLE',
        name: 'Ligne Lyon-Marseille',
        geometry: [
          [4.8234, 45.7640], // Lyon Part-Dieu
          [4.8567, 45.6234], // Givors
          [4.9234, 45.5234], // Saint-Étienne
          [5.0234, 45.4234], // Firminy
          [5.1234, 45.3234], // Le Puy-en-Velay
          [5.2234, 45.2234], // Alès
          [5.3234, 45.1234], // Nîmes
          [5.4234, 45.0234], // Arles
          [5.4567, 43.2965]  // Marseille Saint-Charles
        ],
        pkStart: 0,
        pkEnd: 312.8, // 312.8 km
        direction: 'Lyon → Marseille'
      });

      console.log('✅ Données ferroviaires chargées:', this.railwayLines.size, 'lignes');
    } catch (error) {
      console.error('❌ Erreur chargement données ferroviaires:', error);
    }
  }

  // Calculer la distance entre deux points (formule de Haversine)
  distanceBetween(point1, point2) {
    const [lon1, lat1] = point1;
    const [lon2, lat2] = point2;
    
    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance en mètres
  }

  // Convertir degrés en radians
  deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  // Interpoler un point sur un segment
  interpolatePoint(point1, point2, ratio) {
    const [lon1, lat1] = point1;
    const [lon2, lat2] = point2;
    
    return [
      lon1 + (lon2 - lon1) * ratio,
      lat1 + (lat2 - lat1) * ratio
    ];
  }

  // Calculer les coordonnées à une distance donnée (PK) le long d'une ligne
  getCoordAtPK(lineId, distanceKm) {
    const line = this.railwayLines.get(lineId);
    if (!line) {
      console.error('❌ Ligne non trouvée:', lineId);
      return null;
    }

    const geometry = line.geometry;
    const distanceMeters = distanceKm * 1000;

    // Vérifier que la distance est dans les limites de la ligne
    if (distanceKm < line.pkStart || distanceKm > line.pkEnd) {
      console.warn('⚠️ PK hors limites de la ligne:', distanceKm, 'km');
      return null;
    }

    // Parcourir les segments de la ligne pour trouver le segment contenant la distance
    let accumulated = 0;
    for (let i = 0; i < geometry.length - 1; i++) {
      const segmentLength = this.distanceBetween(geometry[i], geometry[i + 1]);
      
      if (accumulated + segmentLength >= distanceMeters) {
        const segmentDistance = distanceMeters - accumulated;
        const ratio = segmentDistance / segmentLength;
        
        // Interpoler le point sur ce segment
        const interpolatedPoint = this.interpolatePoint(geometry[i], geometry[i + 1], ratio);
        
        return {
          coordinates: interpolatedPoint,
          lineId: lineId,
          lineName: line.name,
          pk: distanceKm,
          segment: i,
          direction: line.direction
        };
      }
      accumulated += segmentLength;
    }

    return null; // PK hors ligne
  }

  // Trouver le PK le plus proche d'un point GPS donné
  findNearestPK(latitude, longitude, maxDistance = 5000) {
    let nearestResult = null;
    let minDistance = Infinity;

    for (const [lineId, line] of this.railwayLines) {
      const geometry = line.geometry;
      
      // Parcourir tous les segments de la ligne
      for (let i = 0; i < geometry.length - 1; i++) {
        const segmentStart = geometry[i];
        const segmentEnd = geometry[i + 1];
        
        // Calculer la distance du point GPS au segment
        const distanceToSegment = this.distancePointToSegment(
          [longitude, latitude], 
          segmentStart, 
          segmentEnd
        );
        
        if (distanceToSegment < minDistance && distanceToSegment <= maxDistance) {
          // Calculer le PK approximatif sur ce segment
          const pkOnSegment = this.calculatePKOnSegment(line, i, [longitude, latitude]);
          
          if (pkOnSegment !== null) {
            minDistance = distanceToSegment;
            nearestResult = {
              coordinates: [longitude, latitude],
              lineId: lineId,
              lineName: line.name,
              pk: pkOnSegment,
              distance: distanceToSegment,
              segment: i,
              direction: line.direction,
              confidence: this.calculateConfidence(distanceToSegment)
            };
          }
        }
      }
    }

    return nearestResult;
  }

  // Calculer la distance d'un point à un segment de ligne
  distancePointToSegment(point, segmentStart, segmentEnd) {
    const [px, py] = point;
    const [x1, y1] = segmentStart;
    const [x2, y2] = segmentEnd;
    
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    
    return Math.sqrt(dx * dx + dy * dy) * 111000; // Conversion en mètres (approximative)
  }

  // Calculer le PK approximatif sur un segment
  calculatePKOnSegment(line, segmentIndex, point) {
    const geometry = line.geometry;
    let accumulatedDistance = 0;
    
    // Calculer la distance jusqu'au début du segment
    for (let i = 0; i < segmentIndex; i++) {
      accumulatedDistance += this.distanceBetween(geometry[i], geometry[i + 1]);
    }
    
    // Calculer la position relative sur le segment actuel
    const segmentStart = geometry[segmentIndex];
    const segmentEnd = geometry[segmentIndex + 1];
    const segmentLength = this.distanceBetween(segmentStart, segmentEnd);
    
    const distanceToSegment = this.distancePointToSegment(point, segmentStart, segmentEnd);
    const distanceAlongSegment = Math.sqrt(
      Math.pow(this.distanceBetween(segmentStart, point), 2) - 
      Math.pow(distanceToSegment, 2)
    );
    
    const pkOnSegment = (accumulatedDistance + distanceAlongSegment) / 1000; // Conversion en km
    
    // Vérifier que le PK est dans les limites de la ligne
    if (pkOnSegment >= line.pkStart && pkOnSegment <= line.pkEnd) {
      return pkOnSegment;
    }
    
    return null;
  }

  // Calculer un score de confiance basé sur la distance
  calculateConfidence(distance) {
    if (distance <= 100) return 'très élevée';
    if (distance <= 500) return 'élevée';
    if (distance <= 1000) return 'moyenne';
    if (distance <= 2000) return 'faible';
    return 'très faible';
  }

  // Formater un PK en format standard SNCF
  formatPK(pk) {
    const km = Math.floor(pk);
    const meters = Math.round((pk - km) * 1000);
    return `PK${km}+${meters.toString().padStart(3, '0')}`;
  }

  // Obtenir les informations d'une ligne
  getLineInfo(lineId) {
    return this.railwayLines.get(lineId);
  }

  // Lister toutes les lignes disponibles
  listLines() {
    const lines = [];
    for (const [id, line] of this.railwayLines) {
      lines.push({
        id: id,
        name: line.name,
        pkStart: line.pkStart,
        pkEnd: line.pkEnd,
        direction: line.direction,
        segments: line.geometry.length - 1
      });
    }
    return lines;
  }

  // Ajouter une nouvelle ligne ferroviaire
  addLine(lineData) {
    const { id, name, geometry, pkStart, pkEnd, direction } = lineData;
    
    if (this.railwayLines.has(id)) {
      console.warn('⚠️ Ligne déjà existante:', id);
      return false;
    }
    
    this.railwayLines.set(id, {
      id,
      name,
      geometry,
      pkStart: pkStart || 0,
      pkEnd: pkEnd || 0,
      direction: direction || 'Non spécifiée'
    });
    
    console.log('✅ Nouvelle ligne ajoutée:', name);
    return true;
  }

  // Sauvegarder les données ferroviaires
  saveRailwayData() {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        lines: Array.from(this.railwayLines.entries())
      };
      
      fs.writeFileSync(
        path.join(__dirname, 'data', 'railway-lines.json'), 
        JSON.stringify(data, null, 2)
      );
      
      console.log('✅ Données ferroviaires sauvegardées');
    } catch (error) {
      console.error('❌ Erreur sauvegarde données ferroviaires:', error);
    }
  }

  // Charger les données depuis un fichier
  loadFromFile(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      this.railwayLines.clear();
      for (const [id, line] of data.lines) {
        this.railwayLines.set(id, line);
      }
      
      console.log('✅ Données ferroviaires chargées depuis:', filePath);
      return true;
    } catch (error) {
      console.error('❌ Erreur chargement fichier:', error);
      return false;
    }
  }

  // Obtenir toutes les lignes ferroviaires
  getRailwayLines() {
    return Array.from(this.railwayLines.values());
  }
}

module.exports = RailwayGeometry; 