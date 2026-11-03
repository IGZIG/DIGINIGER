-- ============================================================================
-- DIGINIGER — Exercices et examens de démonstration
-- ============================================================================
-- Contenu pédagogique réaliste mais volontairement court, destiné aux tests
-- du parcours : leçon → exercice auto-corrigé → examen → certificat.
-- Idempotent : ré-exécutable sans créer de doublons.
-- ============================================================================

with cible as (
  select id, slug, title_fr from public.courses where status = 'published'
),
defs as (
  select * from (values
    ('ia-generative-pratique',
     'Quiz — fondamentaux de l''IA générative',
     'question',
     false, 70, null,
     '[
       {"id":"q1","prompt":"Que désigne un « prompt » dans un modèle de langage ?","choices":[{"id":"a","text":"Une instruction donnée au modèle"},{"id":"b","text":"Le résultat produit par le modèle"},{"id":"c","text":"La puissance de calcul du serveur"}],"correct":0,"explanation":"Le prompt est l''instruction d''entrée."},
       {"id":"q2","prompt":"Quel est le principal risque d''un modèle génératif ?","choices":[{"id":"a","text":"Il produit des réponses factuellement fausses avec assurance"},{"id":"b","text":"Il consomme trop d''écran"},{"id":"c","text":"Il ne fonctionne pas hors ligne"}],"correct":0},
       {"id":"q3","prompt":"Pour une réponse fiable en entreprise, il faut :","choices":[{"id":"a","text":"Faire confiance au modèle par défaut"},{"id":"b","text":"Fournir un contexte documentaire vérifié"},{"id":"c","text":"Poser la question plusieurs fois"}],"correct":1},
       {"id":"q4","prompt":"Le RAG consiste à :","choices":[{"id":"a","text":"Réentraîner le modèle sur vos données"},{"id":"b","text":"Récupérer des extraits de documents et les injecter dans le prompt"},{"id":"c","text":"Compresser les réponses"}],"correct":1},
       {"id":"q5","prompt":"Un bon usage professionnel de l''IA générative inclut :","choices":[{"id":"a","text":"La relecture humaine systématique"},{"id":"b","text":"La publication sans vérification"},{"id":"c","text":"La collecte de données personnelles sans base légale"}],"correct":0}
     ]'::jsonb),
    ('ia-generative-pratique',
     'Examen — IA générative appliquée',
     'examen',
     true, 70, 30,
     '[
       {"id":"e1","prompt":"Quelle pratique réduit le plus les hallucinations ?","choices":[{"id":"a","text":"Augmenter la température"},{"id":"b","text":"Ancrer la réponse sur des documents vérifiés"},{"id":"c","text":"Poser une question plus longue"}],"correct":1},
       {"id":"e2","prompt":"Les données envoyées à un fournisseur de modèle doivent être :","choices":[{"id":"a","text":"Minimisées et justifiées"},{"id":"b","text":"Exhaustives"},{"id":"c","text":"Anonymes mais publiques"}],"correct":0},
       {"id":"e3","prompt":"Un index vectoriel sert à :","choices":[{"id":"a","text":"Stocker des images"},{"id":"b","text":"Retrouver les passages les plus proches sémantiquement"},{"id":"c","text":"Chiffrer la base"}],"correct":1},
       {"id":"e4","prompt":"La traçabilité des réponses IA permet :","choices":[{"id":"a","text":"D''auditer les sources utilisées"},{"id":"b","text":"De supprimer le besoin de formateur"},{"id":"c","text":"De reduire les coûts de serveur"}],"correct":0}
     ]'::jsonb),
    ('developpement-web-fondamentaux',
     'Quiz — HTML, CSS et JavaScript',
     'question',
     false, 60, null,
     '[
       {"id":"q1","prompt":"Quelle balise structure le contenu principal d''une page ?","choices":[{"id":"a","text":"<main>"},{"id":"b","text":"<div>"},{"id":"c","text":"<section>"}],"correct":0},
       {"id":"q2","prompt":"En CSS, quelle propriété contrôle l''alignement sur l''axe principal de Flexbox ?","choices":[{"id":"a","text":"align-items"},{"id":"b","text":"justify-content"},{"id":"c","text":"flex-wrap"}],"correct":1},
       {"id":"q3","prompt":"Que fait `const` sur une variable ?","choices":[{"id":"a","text":"Interdit la modification de la liaison"},{"id":"b","text":"Gèle l''objet en profondeur"},{"id":"c","text":"Rend la variable globale"}],"correct":0},
       {"id":"q4","prompt":"Une fonction asynchrone retourne :","choices":[{"id":"a","text":"Une Promise"},{"id":"b","text":"Un tableau"},{"id":"c","text":"Rien"}],"correct":0}
     ]'::jsonb),
    ('entrepreneuriat-afrique-ouest',
     'Quiz — valider son idée',
     'question',
     false, 60, null,
     '[
       {"id":"q1","prompt":"La première étape avant de produire est :","choices":[{"id":"a","text":"Emprunter un capital"},{"id":"b","text":"Valider le besoin auprès de clients réels"},{"id":"c","text":"Créer le logo"}],"correct":1},
       {"id":"q2","prompt":"Un modèle économique décrit :","choices":[{"id":"a","text":"Comment l''entreprise crée et capture de la valeur"},{"id":"b","text":"Le plan de communication uniquement"},{"id":"c","text":"Les statuts juridiques"}],"correct":0},
       {"id":"q3","prompt":"Un test de marché utile doit :","choices":[{"id":"a","text":"Confirmer l''idée du fondateur"},{"id":"b","text":"Pouvoir démontrer que l''idée est fausse"},{"id":"c","text":"Coûter le plus cher possible"}],"correct":1}
     ]'::jsonb),
    ('comptabilite-syscohada',
     'Quiz — principes SYSCOHADA',
     'question',
     false, 70, null,
     '[
       {"id":"q1","prompt":"Le bilan présente :","choices":[{"id":"a","text":"Le patrimoine à une date donnée"},{"id":"b","text":"Les flux de l''année"},{"id":"c","text":"Les prévisions de ventes"}],"correct":0},
       {"id":"q2","prompt":"La TVA collectée est :","choices":[{"id":"a","text":"Une dette envers l''État"},{"id":"b","text":"Une recette additionnelle"},{"id":"c","text":"Une charge déductible"}],"correct":0},
       {"id":"q3","prompt":"Le compte de résultat mesure :","choices":[{"id":"a","text":"La performance de l''exercice"},{"id":"b","text":"La trésorerie disponible"},{"id":"c","text":"Les immobilisations"}],"correct":0},
       {"id":"q4","prompt":"Un amortissement est :","choices":[{"id":"a","text":"Une charge répartie sur la durée d''usage"},{"id":"b","text":"Un paiement immédiat"},{"id":"c","text":"Une remise commerciale"}],"correct":0}
     ]'::jsonb),
    ('energie-solaire-pompage',
     'Examens — dimensionnement solaire',
     'examen',
     true, 70, 25,
     '[
       {"id":"e1","prompt":"La performance d''une batterie se mesure notamment par :","choices":[{"id":"a","text":"Sa profondeur de décharge admissible"},{"id":"b","text":"Sa couleur"},{"id":"c","text":"Son poids uniquement"}],"correct":0},
       {"id":"e2","prompt":"Le facteur de sécurité corrige :","choices":[{"id":"a","text":"Les pertes système et l''ensoleillement réel"},{"id":"b","text":"La TVA"},{"id":"c","text":"Le prix du câble"}],"correct":0},
       {"id":"e3","prompt":"Un régulateur MPPT permet :","choices":[{"id":"a","text":"De maximiser la puissance extraite"},{"id":"b","text":"De refroidir les panneaux"},{"id":"c","text":"De stocker le courant"}],"correct":0}
     ]'::jsonb)
  ) as t(slug, title_fr, instructions, is_exam, pass_score, time_limit_min, questions)
)
insert into public.exercises (
  course_id, title_fr, kind, instructions, questions, max_score, pass_score,
  time_limit_min, is_exam, is_published, source
)
select
  c.id,
  d.title_fr,
  case d.is_exam when true then 'quiz'::public.exercise_type else 'quiz'::public.exercise_type end,
  case when d.is_exam
    then 'Examen de fin de parcours. Une seule tentative en cours à la fois, cinq tentatives maximum. Seuil de réussite : ' || d.pass_score || ' %.'
    else 'Exercice d''entraînement corrigé automatiquement. Vous pouvez le repasser autant de fois que nécessaire.'
  end,
  d.questions,
  100,
  d.pass_score,
  d.time_limit_min,
  d.is_exam,
  true,
  'manual'
from defs d
join cible c on c.slug = d.slug
where not exists (
  select 1 from public.exercises e
  where e.course_id = c.id and e.title_fr = d.title_fr
);

-- ---------------------------------------------------------------------------
-- Documents pédagogiques de démonstration (support du tuteur IA / RAG)
-- Le contenu textuel est indexé par la route /api/admin/documents/index via
-- un service d'embeddings ; ici on déclare le document comme source validée.
-- ---------------------------------------------------------------------------
insert into public.course_documents (course_id, title, status, mime_type)
select c.id, 'Support de cours — ' || c.title_fr, 'pending', 'text/markdown'
from public.courses c
where c.slug in ('ia-generative-pratique', 'comptabilite-syscohada')
  and not exists (
    select 1 from public.course_documents d
    where d.course_id = c.id and d.title = 'Support de cours — ' || c.title_fr
  );
