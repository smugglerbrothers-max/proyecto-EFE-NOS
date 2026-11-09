#!/usr/bin/env python3
"""Genera assets/criaturas/PROMPTS.md con un prompt de ilustración por criatura (102)."""
import os, re, json, subprocess

D = {
 'ifrit': ["pequeño genio de fuego: una brasa viviente con cuernitos negros, ojos amarillos y cola de humo",
           "genio árabe de fuego y humo: torso musculoso de piel negra con grietas de lava, cuernos, brazos envueltos en llamas, parte inferior de humo",
           "sultán genio demoníaco de fuego, enorme y musculoso, corona de cuernos, brazaletes dorados, cuerpo de lava y humo negro"],
 'ahuizotl': ["cachorro de perro de agua azteca negro azulado con una mano humana al final de la cola, ojos verdes brillantes, colmillos",
              "perro de agua azteca negro azulado y escamoso, mano humana con garras al final de la cola, púas azules, chorreando agua",
              "bestia acuática azteca enorme con armadura de jade y piedra con glifos aztecas, mano gigante con garras en la cola, olas y lluvia"],
 'basilisco': ["serpiente bebé verde tóxica con una pequeña cresta de hueso en forma de corona y ojos amarillos",
               "serpiente-lagarto verde venenosa con corona de hueso, púas en el lomo y baba tóxica verde brillante",
               "rey serpiente gigante de escamas verde oscuro acorazadas, gran corona de hueso, ojos amarillos petrificantes, gas venenoso"],
 'chupacabra': ["cría de chupacabra: reptil gris verdoso flaco con púas en el lomo y enormes ojos rojos",
                "chupacabra bípedo de piel gris verdosa, costillas marcadas, púas dorsales, colmillos huecos, ojos rojos, garras largas",
                "chupacabra gigante acorazado con enormes púas de hueso en el lomo, mandíbula de colmillos huecos manchados de sangre, ojos rojos"],
 'cadejo': ["cachorro de perro negro con ojos rojos como brasas, pezuñas de cabra y cadenitas",
            "perro negro espectral grande arrastrando cadenas, ojos de fuego rojo, pezuñas de cabra, humo negro",
            "perro demonio negro enorme envuelto en cadenas y sombras, ojos rojos llameantes, colmillos enormes, cuernos"],
 'gul': ["pequeño ghoul encorvado de piel gris, ojos verdes, dientes afilados y uñas negras",
         "ghoul árabe demacrado de piel gris cadavérica, encorvado, garras negras, mandíbula llena de colmillos",
         "ghoul gigante con armadura de lápidas y huesos, rostros cosidos al pecho, garras enormes"],
 'harpia': ["polluelo de harpía con rostro de anciana y plumas grises desaliñadas",
            "harpía griega: cuerpo de ave rapaz, rostro de mujer con colmillos, alas de plumas oscuras afiladas, garras",
            "reina harpía de la tormenta con alas enormes de plumas como cuchillas, rayos, garras de metal y corona de plumas"],
 'nahual': ["cachorro de jaguar negro con manchas doradas y ojos humanos amarillos",
            "hombre-jaguar brujo mesoamericano medio erguido, jaguar negro con manchas doradas, ojos humanos brillantes, sonrisa siniestra",
            "jaguar devorador de hombres gigante con armadura azteca de obsidiana, manchas doradas brillantes, garras de obsidiana"],
 'tikbalang': ["potrillo humanoide de patas demasiado largas con cabeza de caballo y ojos cian",
               "tikbalang filipino: cabeza de caballo y cuerpo de hombre flaco y alto de miembros larguísimos, melena negra, ojos brillantes",
               "tikbalang gigante musculoso con melena de espinas doradas, armadura y rayos"],
 'baku': ["cría de baku: pequeño tapir morado con trompa corta y ojos rosados",
          "baku japonés devorador de sueños, cuerpo de tapir-elefante morado, colmillos, trompa larga, humo de pesadillas",
          "baku gigante acorazado con el cuerpo cubierto de ojos, trompa enorme y nubes de pesadilla rosas"],
 'kraken': ["pulpo bebé morado con grandes ojos amarillos y tentáculos con dientes",
            "kraken mediano, calamar-pulpo morado con muchos ojos, tentáculos con bocas dentadas y pico",
            "kraken colosal con caparazón de roca y coral, decenas de tentáculos y muchos ojos amarillos"],
 'nuckelavee': ["potro sin piel con músculos rojos expuestos y venas negras",
                "caballo marino sin piel con un torso humano creciendo de su lomo, músculos rojos, venas negras",
                "demonio nuckelavee: caballo sin piel con jinete fusionado de brazos larguísimos, un solo ojo rojo ardiente, venas negras"],
 'lamia': ["pequeña serpiente roja con cara de niña pálida",
           "lamia griega: torso de mujer pálida de cabello negro y cola de serpiente roja, colmillos",
           "reina lamia gigante con armadura dorada, cola de serpiente enorme, cuatro brazos con garras y corona"],
 'llorona': ["pequeño fantasma de niña con velo blanco, cabello negro y lágrimas negras",
             "la Llorona: fantasma de mujer con vestido blanco roto, cabello negro largo tapando la cara, lágrimas negras, agua",
             "diosa serpiente azteca fantasmal: mujer esquelética con tocado azteca, cola de serpiente y agua oscura"],
 'ammit': ["cría con cabeza de cocodrilo, melena de león y ojos naranjas",
           "devoradora egipcia: cabeza de cocodrilo, cuerpo frontal de león, cuartos traseros de hipopótamo, joyas doradas",
           "Ammit gigante con armadura egipcia de oro y lapislázuli y jeroglíficos brillantes"],
 'jorogumo': ["araña pequeña negra con rayas amarillas y ojos rojos",
              "araña gigante japonesa negra con rayas doradas, patas peludas con garras y marca de calavera en el abdomen",
              "mujer-araña japonesa: torso de mujer en kimono saliendo de un enorme cuerpo de araña negro y dorado"],
 'draugr': ["pequeño cadáver nórdico ahogado de piel azulada saliendo de un túmulo",
            "no-muerto nórdico ahogado, piel azul hinchada, armadura vikinga oxidada, ojos azules brillantes",
            "rey draugr gigante con corona y armadura vikinga, algas colgando, ojos azules brillantes"],
 'leviatan': ["anguila marina bebé negra y azul con ojos amarillos",
              "serpiente marina con aletas, púas y escamas azules",
              "serpiente marina colosal con escamas acorazadas, púas, aletas, olas y rayos"],
 'banshee': ["pequeño espíritu de niña pálida flotando, cabello blanco",
             "banshee irlandesa: espíritu de mujer flotante con harapos grises, cabello blanco largo, boca abierta gritando, ojos rojos",
             "banshee gigante con harapos, ondas de grito espectral y manos largas esqueléticas"],
 'strigoi': ["murciélago pequeño con cara humana pálida",
             "vampiro rumano monstruoso con alas de murciélago, piel pálida, colmillos y garras",
             "señor vampiro gigante con armadura gótica negra y roja y alas enormes"],
 'gashadokuro': ["cráneo pequeño con cuerpo de esqueleto chibi y fuego verde en los ojos",
                 "esqueleto mediano hecho de muchos huesos unidos con llamas cian",
                 "esqueleto gigante japonés con fuego fantasmal cian en las cuencas, brazos largos con garras de hueso"],
 'tunche': ["pequeño espíritu de la selva: sombra verde con ojos blancos",
            "espíritu de la selva amazónica: figura sombría encapuchada de hojas y raíces, ojos blancos brillantes",
            "espíritu gigante de la selva con cuerpo de raíces y hojas oscuras y máscara de calavera de madera"],
 'rokurokubi': ["cabeza de muñeca japonesa que flota sola",
                "cabeza de mujer japonesa flotante separada del cuerpo, cabello negro largo, sonrisa de dientes negros",
                "mujer japonesa en kimono con un cuello larguísimo que serpentea"],
 'aswang': ["bebé demonio filipino con colmillos",
            "manananggal filipina: torso de mujer con alas de murciélago, sin piernas, lengua larga",
            "monstruo filipino cambiaformas gigante con alas de murciélago y lengua de probóscide"],
 'mara': ["mancha de sombra con varios ojos rosados",
          "masa de sombra morada con muchos ojos y bocas, manos saliendo de ella",
          "demonio de la pesadilla gigante, cuerpo de sombra con cientos de ojos rosados y bocas"],
 'wendigo': ["cervatillo esquelético con cráneo de ciervo por cara",
             "wendigo alto y esquelético con cráneo de ciervo con astas y piel gris pegada a las costillas",
             "wendigo gigante con astas enormes, hielo y garras larguísimas"],
 'gorgona': ["pequeña gorgona: niña-serpiente verde con cabello de gusanos",
             "gorgona: torso de mujer verde con cabello de serpientes vivas, cola de serpiente, ojos amarillos",
             "reina gorgona con armadura griega de bronce, cabello de serpientes y alas doradas"],
 'fenrir': ["cachorro de lobo gris oscuro con una cadena",
            "perro-lobo infernal nórdico de pelaje gris oscuro, pecho manchado de sangre y cadenas",
            "lobo colosal nórdico con cadenas rotas, runas brillantes y armadura"],
 'manticora': ["cachorro de león con rostro humano sonriente y pequeña cola de escorpión",
               "mantícora persa: cuerpo de león rojo, rostro humano con tres filas de dientes, cola de escorpión con púas",
               "mantícora gigante acorazada con alas y aguijón enorme"],
 'quimera': ["cachorro de león con cola de serpiente y cuernitos de cabra",
             "quimera griega con cabeza de león, cabeza de cabra en el lomo y cola de serpiente, fuego",
             "quimera gigante de tres cabezas escupiendo fuego con armadura volcánica"],
 'tzitzimitl': ["pequeña calavera azteca de estrellas",
                "demonio estelar azteca esquelético con falda de estrellas, garras y tocado azteca",
                "diosa demonio esquelética cósmica gigante con estrellas y galaxias en el cuerpo"],
 'cerbero': ["cachorro de perro infernal de una cabeza con melena de fuego",
             "perro infernal de DOS cabezas con melena de fuego, armadura de hueso, grietas de lava y cadenas",
             "Cerbero gigante de TRES cabezas con armadura de hueso, lava, fuego y cadenas"],
 'moloch': ["becerro de bronce con ojos de fuego",
            "demonio con cabeza de toro y cuerpo de bronce con un horno ardiente en el vientre",
            "dios demonio toro colosal de bronce y lava con horno ardiente en el pecho y cuernos enormes"],
 'tiamat': ["lagartija bebé de barro verde azulado",
            "dragón-serpiente babilónico de cuerpo escamoso, cuernos, patas delanteras de león y traseras de águila",
            "dragona del caos de tres cabezas con alas y escamas verde oscuro y negro, agua del abismo"],
}
ETAPA = ["etapa 1 de 3: forma bebé pequeña tipo chibi, tierna pero inquietante",
         "etapa 2 de 3: forma juvenil más grande y agresiva, con algo de armadura",
         "etapa 3 de 3: forma final enorme e imponente, muy acorazada, con aura de poder"]
ESTILO = ("Estilo: ilustración de monstruo estilo fakemon/anime de alta calidad, contornos negros gruesos tipo cómic, "
          "colores intensos, aspecto de horror. Cuerpo completo, vista 3/4 mirando hacia la DERECHA, fondo blanco liso, sin texto.")

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
js = open(os.path.join(root, 'js', 'data.js'), encoding='utf8').read()
lines = re.findall(r"\['(\w+)', '([^']+)', \['([^']+)', '([^']+)', '([^']+)'\], \[([^\]]+)\]", js)
TN = {'SOMBRA':'Sombra','SANGRE':'Sangre','HUESO':'Hueso','ABISMO':'Abismo','INFIERNO':'Infierno','PLAGA':'Plaga','ESPECTRO':'Espectro','BESTIA':'Bestia','TORMENTA':'Tormenta','LOCURA':'Locura'}
done = set(os.path.splitext(f)[0] for f in os.listdir(os.path.join(root, 'assets', 'criaturas')) if f.endswith('.png'))
out = ["# Prompts de ilustración — 102 criaturas de UMBRAL", "",
       "Copia cada prompt en tu generador de imágenes (Canva, Gemini, ChatGPT, Bing, etc.).",
       "Guarda cada resultado y procésalo con:", "",
       "```", "python3 tools/quitar_fondo.py <id> <imagen>", "python3 tools/empaquetar_sprites.py", "```", "",
       f"Hechas: {len(done)} / 102 (marcadas con ✅).", ""]
n = 1
for key, origin, a, b, c, types in lines:
    tys = ' / '.join(TN[t] for t in re.findall(r"'(\w+)'", types))
    for s, name in enumerate([a, b, c]):
        cid = f'{key}_{s+1}'
        mark = '✅' if cid in done else '⬜'
        prompt = f'Criatura: "{name}", {D[key][s]}, mitología {origin}, tipo {tys}, {ETAPA[s]}. {ESTILO}'
        out += [f"### {mark} #{n:03d} {name} — id `{cid}`", "", "```", prompt, "```", ""]
        n += 1
open(os.path.join(root, 'assets', 'criaturas', 'PROMPTS.md'), 'w', encoding='utf8').write('\n'.join(out))
print('PROMPTS.md generado,', n - 1, 'criaturas;', len(done), 'hechas')
