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
        infoHeizlast: document.getElementById('info-heizlast'),
        resKuehllast: document.getElementById('res-kuehllast'),
        infoKuehllast: document.getElementById('info-kuehllast'),
        erlaeuterung: document.getElementById('erlaeuterung'),
    };

    const allInputs = document.querySelectorAll('input, select');
    allInputs.forEach(input => input.addEventListener('input', calculateAll));

    // --- Voreinstellungen und Konstanten ---
    const presets = {
        raumtypen: {
            buero: { personenLast: 100, luftratePerson: 36, luftwechsel: 0 },
            seminar: { personenLast: 120, luftratePerson: 36, luftwechsel: 0 },
            labor: { personenLast: 140, luftratePerson: 36, luftwechsel: 8 },
            technik: { personenLast: 0, luftratePerson: 0, luftwechsel: 2 },
        },
        gebaeude: {
            altbau: { u_wand: 0.8, u_fenster: 2.8, u_dach: 0.6 },
            modern: { u_wand: 0.28, u_fenster: 1.1, u_dach: 0.2 },
        },
        temperaturen: {
            innen_winter: 21, aussen_winter: -10,
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
        } else {
            dom.personenAnzahl.value = 4;
            dom.geraeteLast.value = 800;
        }
        calculateAll();
    }
    
    dom.raumtyp.addEventListener('change', updateDefaults);

    function calculateAll() {
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

        // 2. Geometrie und Flächen berechnen
        const raumflaeche = inputs.laenge * inputs.breite;
        const raumvolumen = raumflaeche * inputs.hoehe;
        const wandflaeche = (inputs.laenge + inputs.breite) * 2 * inputs.hoehe - inputs.fensterFlaeche;

        const p = presets;
        const raumSettings = p.raumtypen[inputs.raumtyp];
        const gebaeudeSettings = p.gebaeude[inputs.gebaeudetyp];

        // 3. Luftvolumenstrom ermitteln
        const v_personen = inputs.personen * raumSettings.luftratePerson;
        const v_luftwechsel = raumvolumen * raumSettings.luftwechsel;
        const v_kuehllast = (inputs.personen * raumSettings.personenLast + inputs.geraete + inputs.licht) / (p.cp_luft * (p.temperaturen.aussen_sommer - p.temperaturen.innen_sommer));
        
        let v_final = Math.max(v_personen, v_luftwechsel);
        let v_info = v_personen > v_luftwechsel ? "Hygiene (Personen)" : "Raum-Luftwechsel";

        if (inputs.raumtyp === 'technik' && v_kuehllast > v_final) {
            v_final = v_kuehllast;
            v_info = "Wärmelastabfuhr";
        }
        
        // 4. Heizlast berechnen
        const dt_winter = p.temperaturen.innen_winter - p.temperaturen.aussen_winter;
        const heizlast_transmission = (wandflaeche * gebaeudeSettings.u_wand + inputs.fensterFlaeche * gebaeudeSettings.u_fenster + raumflaeche * gebaeudeSettings.u_dach) * dt_winter;
        const heizlast_lueftung = v_final * p.cp_luft * dt_winter;
        const heizlast_total_kw = (heizlast_transmission + heizlast_lueftung) / 1000;

        // 5. Kühllast berechnen
        const kuehllast_intern = inputs.personen * raumSettings.personenLast + inputs.geraete + inputs.licht;
        const kuehllast_sonne = inputs.fensterFlaeche * p.sonnenlast_fenster;
        const kuehllast_total_kw = (kuehllast_intern + kuehllast_sonne) / 1000;

        // 6. Ergebnisse anzeigen
        dom.resVolumenstrom.textContent = `${Math.ceil(v_final)} m³/h`;
        dom.infoVolumenstrom.textContent = `Grundlage: ${v_info}`;
        dom.resHeizlast.textContent = `${heizlast_total_kw.toFixed(2)} kW`;
        dom.resKuehllast.textContent = `${kuehllast_total_kw.toFixed(2)} kW`;
        
        dom.erlaeuterung.innerHTML = `
            <strong>Zusammensetzung der Heizlast:</strong><br>
            Anteil Transmission (Wände, Fenster, Dach): <strong>${(heizlast_transmission / 1000).toFixed(2)} kW</strong><br>
            Anteil Lüftung (Aufheizen der Frischluft): <strong>${(heizlast_lueftung / 1000).toFixed(2)} kW</strong><br><br>
            <strong>Zusammensetzung der Kühllast:</strong><br>
            Anteil Interne Lasten (Personen, Geräte, Licht): <strong>${(kuehllast_intern / 1000).toFixed(2)} kW</strong><br>
            Anteil Sonneneinstrahlung (durch Fenster): <strong>${(kuehllast_sonne / 1000).toFixed(2)} kW</strong>
        `;
    }

    // Initiale Berechnung beim Laden der Seite
    updateDefaults();
});
