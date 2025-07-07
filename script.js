function calculateAll() {
        const sicherheitshinweise = [];
        const hinweise = []; 
        
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
        if (raumflaeche === 0) return;

        const raumvolumen = raumflaeche * inputs.hoehe;
        const p = presets;
        const raumSettings = p.raumtypen[inputs.raumtyp];
        const gebaeudeSettings = p.gebaeude[inputs.gebaeudetyp];
        
        const v_personen = inputs.personen * raumSettings.luftratePerson;
        const v_luftwechsel = raumvolumen * raumSettings.luftwechsel;
        const v_flaeche = raumflaeche * (raumSettings.luftrateFlaeche || 0);
        
        const waermelast_intern = inputs.personen * raumSettings.personenLast + inputs.geraete + inputs.licht;
        const v_waermelast = waermelast_intern / (p.cp_luft * (p.temperaturen.aussen_sommer - p.temperaturen.innen_sommer));
        
        const kandidaten = {
            'Hygiene': v_personen,
            'Mindest-Luftwechsel': v_luftwechsel,
            'Flächenrate': v_flaeche,
            'Wärmelastabfuhr': (inputs.raumtyp === 'technik' || inputs.raumtyp === 'hoersaal' ? v_waermelast : 0)
        };
        
        let v_final = 0;
        let v_info = 'Kein Bedarf';
        for (const [key, value] of Object.entries(kandidaten)) {
            if (value > v_final) {
                v_final = value;
                v_info = key;
            }
        }
        
        const personen_pro_m2 = inputs.personen / raumflaeche;
        if (raumSettings.maxPersonenProM2 > 0 && personen_pro_m2 > raumSettings.maxPersonenProM2) {
            const empfohlene_pers = Math.floor(raumflaeche * raumSettings.maxPersonenProM2);
            sicherheitshinweise.push(`⚠️ <strong>Personendichte:</strong> Die Dichte von <strong>${personen_pro_m2.toFixed(1)} Pers./m²</strong> ist sehr hoch. Empfohlen sind ca. <strong>${raumSettings.maxPersonenProM2.toFixed(1)} Pers./m²</strong> (max. ${empfohlene_pers} Personen für diesen Raum).`);
        }
        
        if (inputs.raumtyp === 'labor') {
            hinweise.push(`💡 <strong>Normbezug Labor:</strong> Der Luftbedarf wird aus dem höchsten Wert von Personenbedarf, <strong>${raumSettings.luftwechsel}-fachem Luftwechsel</strong> oder <strong>${raumSettings.luftrateFlaeche} m³/h pro m²</strong> ermittelt (gem. TRGS 526 / DIN 1946-7).`);
        } else if (['buero', 'seminar', 'hoersaal'].includes(inputs.raumtyp)) {
             hinweise.push(`💡 <strong>Normbezug Büro/Seminar/Hörsaal:</strong> Der Luftbedarf pro Person von <strong>${raumSettings.luftratePerson} m³/h</strong> entspricht den Anforderungen der Arbeitsstättenregel (ASR A3.6).`);
        } else if (inputs.raumtyp === 'technik') {
             hinweise.push(`💡 <strong>Normbezug Technik/Serverraum:</strong> Die Auslegung erfolgt primär nach Wärmelast. Ein Mindestluftwechsel von <strong>${raumSettings.luftwechsel} 1/h</strong> dient zur Grundlüftung (vgl. VDI 2054).`);
        }
        
        const kuehllast_total_w = waermelast_intern + (inputs.fensterFlaeche * p.sonnenlast_fenster);
        const temp_ohne_kuehlung = v_final > 0 ? p.temperaturen.aussen_sommer + kuehllast_total_w / (v_final * p.cp_luft) : p.temperaturen.aussen_sommer + kuehllast_total_w;
        if (temp_ohne_kuehlung > p.temperaturen.max_asr) {
            sicherheitshinweise.push(`⚠️ <strong>Temperatur-Check (ASR A3.5):</strong> Ohne Kühlung würde die Raumtemperatur ca. <strong>${temp_ohne_kuehlung.toFixed(1)}°C</strong> erreichen. Maßnahmen zur Temperatursenkung sind erforderlich.`);
        }
        
        const dt_winter = p.temperaturen.innen_winter - p.temperaturen.aussen_winter;
        const heizlast_transmission = ( (inputs.laenge + inputs.breite) * 2 * inputs.hoehe - inputs.fensterFlaeche) * gebaeudeSettings.u_wand * dt_winter + inputs.fensterFlaeche * gebaeudeSettings.u_fenster * dt_winter + raumflaeche * gebaeudeSettings.u_dach * dt_winter;
        const heizlast_lueftung = v_final * p.cp_luft * dt_winter;
        const heizlast_total_kw = (heizlast_transmission + heizlast_lueftung - waermelast_intern * 0.5) / 1000;

        dom.resVolumenstrom.textContent = `${Math.ceil(v_final)} m³/h`;
        dom.infoVolumenstrom.textContent = `Grundlage: ${v_info}`;
        dom.resHeizlast.textContent = `${heizlast_total_kw.toFixed(2)} kW`;
        dom.resKuehllast.textContent = `${(kuehllast_total_w / 1000).toFixed(2)} kW`;
        
        // *** NEU: Detaillierte Formel-Anzeige ***
        dom.erlaeuterung.innerHTML = `
            <p style="margin-bottom: 0.8rem;"><strong>Zusammensetzung Luftbedarf:</strong></p>
            <p>Personen: ${inputs.personen} Pers. × ${raumSettings.luftratePerson} m³/h/Pers. = <strong>${v_personen.toFixed(0)} m³/h</strong></p>
            <p>Luftwechsel: ${raumvolumen.toFixed(1)} m³ × ${raumSettings.luftwechsel} 1/h = <strong>${v_luftwechsel.toFixed(0)} m³/h</strong></p>
            <p>Flächenbedarf: ${raumflaeche.toFixed(1)} m² × ${raumSettings.luftrateFlaeche || 0} m³/h/m² = <strong>${v_flaeche.toFixed(0)} m³/h</strong></p>
        `;

        renderHinweise(dom.hinweisBox, hinweise);
        renderHinweise(dom.sicherheitshinweisBox, sicherheitshinweise);
    }
