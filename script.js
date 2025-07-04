document.addEventListener('DOMContentLoaded', () => {

    const dom = {
        // Inputs
        raumtyp: document.getElementById('raumtyp'),
        gebaeudetyp: document.getElementById('gebaeudetyp'),
        raumLaenge: document.getElementById('raumLaenge'),
        raumBreite: document.getElementById('raumBreite'),
        raumHoehe: document.getElementById('raumHoehe'),
        fensterFlaeche: document.getElementById('fensterFlaeche'),
        personenAnzahl: document.getElementById('personenAnzahl'),
        geraeteLast: document.getElementById('geraeteLast'),
        lichtLast: document.getElementById('lichtLast'),
        // Results
        resVolumenstrom: document.getElementById('res-volumenstrom'),
        infoVolumenstrom: document.getElementById('info-volumenstrom'),
        resHeizlast: document.getElementById('res-heizlast'),
        resKuehllast: document.getElementById('res-kuehllast'),
        erlaeuterung: document.getElementById('erlaeuterung'),
        // NEU: Hinweis-Box
        hinweisBox: document.getElementById('hinweis-box'),
    };

    const allInputs = document.querySelectorAll('input, select');
    allInputs.forEach(input => input.addEventListener('input', calculateAll));

    // --- Voreinstellungen und Konstanten ---
    const presets = {
        raumtypen: {
            buero: { personenLast: 100, luftratePerson: 36, luftwechsel: 0, maxPersonenProM2: 0.2 }, // 5 m²/Person
            seminar: { personenLast: 120, luftratePerson: 36, luftwechsel: 0, maxPersonenProM2: 1.0 }, // 1 Person/m²
            labor: { personenLast: 140, luftratePerson: 36, luftwechsel: 8, maxPersonenProM2: 0.2 },
            technik: { personenLast: 0, luftratePerson: 0, luftwechsel: 2, maxPersonenProM2: 0 },
        },
        // U-Werte in W/m²K
        gebaeude: {
            unsaniert_alt: { u_wand: 1.4, u_fenster: 2.8, u_dach: 0.8 },
            saniert_alt: { u_wand: 0.8, u_fenster: 1.9, u_dach: 0.4 },
            enev2002: { u_wand: 0.4, u_fenster: 1.3, u_dach: 0.25 },
            modern: { u_wand: 0.25, u_fenster: 0.9, u_dach: 0.18 },
        },
        temperaturen: {
            innen_winter: 21, aussen_winter: -10, // NRW Auslegungstemperatur
            innen_sommer: 24, aussen_sommer: 32,
        },
        sonnenlast_fenster: 150, // W/m²
        cp_luft: 0.34, // Wh/m³K
    };

    function updateDefaults() {
        const raumtyp = dom.raumtyp.value;
        if (raumtyp === 'technik') {
            dom.personenAnzahl.value = 0;
            dom.geraeteLast.value = 5000;
        } else if (raumtyp === 'labor') {
            dom.personenAnzahl.value = 2;
            dom.geraeteLast.value = 1500;
        } else if (raumtyp === 'seminar') {
             dom.personenAnzahl.value = 15;
            dom.geraeteLast.value = 500;
        } else {
            dom.personenAnzahl.value = 4;
            dom.geraeteLast.value = 800;
        }
        calculateAll();
    }
    
    dom.raumtyp.addEventListener('change', updateDefaults);

    function calculateAll() {
        const hinweise = []; // Array für alle Hinweise
        
        // 1. Eingabewerte sammeln
        const inputs = {
            raumtyp: dom.raumtyp.value,
            gebaeudetyp: dom.gebaeudetyp.value,
            laenge: parseFloat(dom.raumLaenge.value) || 0,
            breite: parseFloat(dom.raumBreite.value) || 0,
            hoehe: parseFloat(dom.raumHoehe.value) || 0,
            fensterFlaeche: parseFloat(dom.fensterFlaeche.value) || 0,
            personen: parseInt(dom.personenAnzahl.value) || 0,
            geraete: parseFloat(dom.geraeteLast.value) || 0,
            licht: parseFloat(dom.lichtLast.value) || 0,
        };

        const raumflaeche = inputs.laenge * inputs.breite;
        if (raumflaeche === 0) return; // Abbruch bei fehlenden Maßen

        const raumvolumen = raumflaeche * inputs.hoehe;
        const wandflaeche = (inputs.laenge + inputs.breite) * 2 * inputs.hoehe - inputs.fensterFlaeche;

        const p = presets;
        const raumSettings = p.raumtypen[inputs.raumtyp];
        const gebaeudeSettings = p.gebaeude[inputs.gebaeudetyp];

        // 2. Hinweise generieren
        if (raumSettings.maxPersonenProM2 > 0 && (inputs.personen / raumflaeche) > raumSettings.maxPersonenProM2) {
            hinweise.push(`💡 <strong>Personendichte:</strong> Die angegebene Personenzahl ist sehr hoch. Beachten Sie die Vorgaben der Versammlungsstättenverordnung (VStättV), die oft max. 1-2 Pers./m² vorschreibt.`);
        }
        if (inputs.raumtyp === 'labor') {
            hinweise.push(`💡 <strong>Labor-Lüftung:</strong> Für Labore wird i.d.R. ein <strong>${raumSettings.luftwechsel}-facher Luftwechsel</strong> zur sicheren Verdünnung von Stoffen gefordert (gem. DGUV Information 213-850).`);
        }

        // 3. Luftvolumenstrom ermitteln
        const v_personen = inputs.personen * raumSettings.luftratePerson;
        const v_luftwechsel = raumvolumen * raumSettings.luftwechsel;
        const waermelast_intern = inputs.personen * raumSettings.personenLast + inputs.geraete + inputs.licht;
        const v_waermelast = waermelast_intern / (p.cp_luft * (p.temperaturen.aussen_sommer - p.temperaturen.innen_sommer));
        
        let v_final = Math.max(v_personen, v_luftwechsel, (inputs.raumtyp === 'technik' ? v_waermelast : 0));
        let v_info = "Hygiene (Personen)";
        if (v_luftwechsel > v_personen) v_info = "Raum-Luftwechsel";
        if (inputs.raumtyp === 'technik' && v_waermelast > v_final) v_info = "Wärmelastabfuhr";
        
        // 4. Heizlast berechnen
        const dt_winter = p.temperaturen.innen_winter - p.temperaturen.aussen_winter;
        const heizlast_transmission = (wandflaeche * gebaeudeSettings.u_wand + inputs.fensterFlaeche * gebaeudeSettings.u_fenster + raumflaeche * gebaeudeSettings.u_dach) * dt_winter;
        const heizlast_lueftung = v_final * p.cp_luft * dt_winter;
        const heizlast_total_kw = (heizlast_transmission + heizlast_lueftung - waermelast_intern * 0.5) / 1000; // 50% der internen Lasten angenommen

        // 5. Kühllast berechnen
        const kuehllast_sonne = inputs.fensterFlaeche * p.sonnenlast_fenster;
        const kuehllast_total_kw = (waermelast_intern + kuehllast_sonne) / 1000;

        // 6. Ergebnisse anzeigen
        dom.resVolumenstrom.textContent = `${Math.ceil(v_final)} m³/h`;
        dom.infoVolumenstrom.textContent = `Grundlage: ${v_info}`;
        dom.resHeizlast.textContent = `${heizlast_total_kw.toFixed(2)} kW`;
        dom.resKuehllast.textContent = `${kuehllast_total_kw.toFixed(2)} kW`;
        
        dom.erlaeuterung.innerHTML = `
            <p><strong>Detaillierter Luftbedarf:</strong>
            Personen: ${v_personen.toFixed(0)} m³/h | 
            Luftwechsel: ${v_luftwechsel.toFixed(0)} m³/h | 
            Wärmelast: ${v_waermelast > 0 ? v_waermelast.toFixed(0) : 0} m³/h</p>
            <p><strong>Detaillierte Kühllast:</strong>
            Interne Lasten: ${(waermelast_intern / 1000).toFixed(2)} kW | 
            Sonneneinstrahlung: ${(kuehllast_sonne / 1000).toFixed(2)} kW</p>
        `;

        // 7. Hinweise anzeigen oder ausblenden
        if (hinweise.length > 0) {
            dom.hinweisBox.innerHTML = hinweise.map(h => `<p>${h}</p>`).join('');
            dom.hinweisBox.style.display = 'block';
        } else {
            dom.hinweisBox.style.display = 'none';
        }
    }

    // Initiale Berechnung beim Laden der Seite
    updateDefaults();
});
