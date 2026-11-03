-- ============================================================================
-- DIGINIGER — Jeu de données de DÉMONSTRATION
-- ============================================================================
-- Ce fichier est idempotent : il peut être rejoué sans créer de doublons.
-- Les contenus sont fictifs et servent uniquement à peupler le catalogue.
-- Aucun utilisateur n'est créé ici : les comptes passent par Supabase Auth
-- (voir scripts/seed.mjs pour les comptes de démonstration).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Offres
-- ---------------------------------------------------------------------------
insert into public.plans (code, name_fr, name_en, description_fr, description_en, audience, price_xof, interval, features_fr, features_en, ai_messages_per_day, course_access, is_featured, position)
values
  ('free', 'Gratuit', 'Free', 'Pour découvrir la plateforme et suivre les cours gratuits.', 'Explore the platform and take free courses.', 'individual', 0, 'month',
    array['Accès aux formations gratuites', 'Tuteur IA : 10 messages / jour', 'Suivi de progression de base', 'Communauté d''apprenants'],
    array['Access to free courses', 'AI tutor: 10 messages / day', 'Basic progress tracking', 'Learner community'], 10, 'free', false, 1),
  ('standard', 'Standard', 'Standard', 'Pour un apprenant régulier qui veut progresser chaque semaine.', 'For regular learners building skills weekly.', 'individual', 7500, 'month',
    array['Toutes les formations Standards', 'Tuteur IA : 100 messages / jour', 'Exercices corrigés automatiquement', 'Certificats de réussite', 'Support par email sous 48 h'],
    array['All Standard courses', 'AI tutor: 100 messages / day', 'Auto-graded exercises', 'Completion certificates', 'Email support within 48 h'], 100, 'all', true, 2),
  ('premium', 'Premium', 'Premium', 'Accompagnement complet, parcours personnalisé et mentorat.', 'Full guidance, personalized pathway and mentoring.', 'individual', 15000, 'month',
    array['Tout le catalogue, y compris Premium', 'Tuteur IA illimité', 'Parcours personnalisé par l''IA', 'Sessions de mentorat mensuelles', 'Revue de projets par un formateur', 'Certificats prioritaires'],
    array['Entire catalog including Premium', 'Unlimited AI tutor', 'AI personalized pathway', 'Monthly mentoring sessions', 'Project review by an instructor', 'Priority certificates'], 1000, 'premium', false, 3),
  ('business', 'Entreprises', 'Business', 'Formation d''équipes avec suivi et facturation dédiée.', 'Team training with tracking and invoicing.', 'business', 0, 'month',
    array['Académie interne clé en main', 'Tableau de bord RH', 'Parcours métiers co-construits', 'Sessions sur site', 'Attestations personnalisées'],
    array['Turnkey internal academy', 'HR dashboard', 'Co-built job pathways', 'On-site sessions', 'Custom attestations'], 0, 'all', false, 4)
on conflict (code) do update set
  name_fr = excluded.name_fr, name_en = excluded.name_en,
  price_xof = excluded.price_xof, features_fr = excluded.features_fr,
  features_en = excluded.features_en, ai_messages_per_day = excluded.ai_messages_per_day,
  course_access = excluded.course_access, is_featured = excluded.is_featured,
  position = excluded.position, description_fr = excluded.description_fr,
  description_en = excluded.description_en;

-- ---------------------------------------------------------------------------
-- Six écoles
-- ---------------------------------------------------------------------------
insert into public.schools (slug, name_fr, name_en, tagline_fr, tagline_en, description_fr, description_en, icon, accent, position)
values
  ('ai-technology', 'AI & Technology', 'AI & Technology',
   'Intelligence artificielle, données et développement',
   'Artificial intelligence, data and software',
   'Apprenez à concevoir, entraîner et déployer des solutions d''intelligence artificielle, à analyser des données et à développer des applications utiles à votre contexte.',
   'Learn to design, train and deploy AI solutions, analyze data and build applications that fit your context.',
   'cpu', '#2563EB', 1),
  ('business-entrepreneurship', 'Business & Entrepreneurship', 'Business & Entrepreneurship',
   'Créer, financer et développer son entreprise',
   'Create, fund and grow your business',
   'De l''idée au business plan, de la gestion d''équipe au financement, développez les réflexes des entrepreneurs qui durent.',
   'From idea to business plan, from team management to fundraising, build the habits of resilient entrepreneurs.',
   'briefcase', '#F59E0B', 2),
  ('agriculture-agro-industry', 'Agriculture & Agro-industry', 'Agriculture & Agro-industry',
   'Produire mieux, transformer et commercialiser',
   'Produce better, process and sell',
   'Agriculture moderne, agronomie appliquée, transformation agroalimentaire et chaînes de valeur adaptées au Sahel.',
   'Modern agriculture, applied agronomy, food processing and value chains adapted to the Sahel.',
   'sprout', '#16A34A', 3),
  ('finance-accounting', 'Finance & Accounting', 'Finance & Accounting',
   'Comptabilité, fiscalité et gestion financière',
   'Accounting, tax and financial management',
   'Maîtrisez les principes comptables SYSCOHADA, la fiscalité, l''analyse financière et la gestion de trésorerie.',
   'Master SYSCOHADA accounting principles, taxation, financial analysis and cash management.',
   'calculator', '#0EA5E9', 4),
  ('marketing-commerce', 'Marketing & Commerce', 'Marketing & Commerce',
   'Vendre et faire grandir une marque',
   'Sell and grow a brand',
   'Marketing digital, vente, expérience client et commerce en ligne : atteignez vos clients là où ils se trouvent.',
   'Digital marketing, sales, customer experience and e-commerce: reach your customers where they are.',
   'megaphone', '#DB2777', 5),
  ('industry-technical-trades', 'Industry & Technical Trades', 'Industry & Technical Trades',
   'Métiers techniques et maintenance',
   'Technical trades and maintenance',
   'Électricité, énergie solaire, maintenance industrielle, sécurité et qualité pour les professionnels de terrain.',
   'Electrical work, solar energy, industrial maintenance, safety and quality for field professionals.',
   'wrench', '#7C3AED', 6)
on conflict (slug) do update set
  name_fr = excluded.name_fr, name_en = excluded.name_en,
  tagline_fr = excluded.tagline_fr, tagline_en = excluded.tagline_en,
  description_fr = excluded.description_fr, description_en = excluded.description_en,
  icon = excluded.icon, accent = excluded.accent, position = excluded.position;

-- ---------------------------------------------------------------------------
-- Formateurs et formations de démonstration
-- ---------------------------------------------------------------------------
do $$
declare
  v_school_ai uuid;   v_school_biz uuid;  v_school_agri uuid;
  v_school_fin uuid;  v_school_mkt uuid;  v_school_ind uuid;
  v_inst1 uuid; v_inst2 uuid; v_inst3 uuid; v_inst4 uuid; v_inst5 uuid; v_inst6 uuid;
  v_course uuid;
  r record;
begin
  select id into v_school_ai   from public.schools where slug = 'ai-technology';
  select id into v_school_biz  from public.schools where slug = 'business-entrepreneurship';
  select id into v_school_agri from public.schools where slug = 'agriculture-agro-industry';
  select id into v_school_fin  from public.schools where slug = 'finance-accounting';
  select id into v_school_mkt  from public.schools where slug = 'marketing-commerce';
  select id into v_school_ind  from public.schools where slug = 'industry-technical-trades';

  -- Formateurs fictifs (comptes de démonstration créés par scripts/seed.mjs).
  -- Si les comptes n'existent pas encore, instructor_id reste NULL : le
  -- catalogue affiche « Formateur DIGINIGER ».
  select id into v_inst1 from public.profiles where email = 'aissatou.demo@diginiger.test';
  select id into v_inst2 from public.profiles where email = 'moussa.demo@diginiger.test';
  select id into v_inst3 from public.profiles where email = 'fatou.demo@diginiger.test';
  select id into v_inst4 from public.profiles where email = 'ibrahim.demo@diginiger.test';
  select id into v_inst5 from public.profiles where email = 'ramatou.demo@diginiger.test';
  select id into v_inst6 from public.profiles where email = 'souleymane.demo@diginiger.test';

  for r in
    select * from (values
      ('ia-generative-pratique', 'IA générative appliquée aux métiers', 'Passer de la curiosité à la production : prompts, automatisations et cas d''usage concrets.',
       v_school_ai, 1, 'intermediaire', 24999, 24.5, 4.8, 128, 3420, true, 'from-electric-600 via-electric-500 to-night-800'),
      ('developpement-web-fondamentaux', 'Développement web : les fondamentaux', 'HTML, CSS, JavaScript et React pour construire vos premières applications.',
       v_school_ai, 2, 'debutant', 0, 32.0, 4.7, 96, 5140, true, 'from-night-800 via-night-600 to-electric-500'),
      ('python-analyse-donnees', 'Python pour l''analyse de données', 'Pandas, visualisation et introduction au machine learning appliqué.',
       v_school_ai, 3, 'intermediaire', 29999, 28.0, 4.6, 74, 2180, false, 'from-electric-700 to-cyan-500'),
      ('entrepreneuriat-afrique-ouest', 'Entrepreneuriat en Afrique de l''Ouest', 'Valider une idée, construire un modèle économique et lever ses premiers fonds.',
       v_school_biz, 4, 'debutant', 14999, 18.0, 4.9, 210, 4310, true, 'from-gold-600 via-gold-500 to-night-700'),
      ('gestion-equipe-pme', 'Gestion d''équipe en PME', 'Recruter, déléguer, motiver et piloter la performance d''une petite équipe.',
       v_school_biz, 5, 'intermediaire', 19999, 15.0, 4.5, 58, 1270, false, 'from-night-700 to-gold-600'),
      ('agro-business-chaine-valeur', 'Agro-business : maîtriser la chaîne de valeur', 'De la production au marché : structurer une activité agroalimentaire rentable.',
       v_school_agri, 6, 'avance', 24999, 22.0, 4.7, 41, 980, true, 'from-green-700 to-emerald-500'),
      ('agriculture-sahel-climat', 'Agriculture résiliente au Sahel', 'Techniques de conservation des sols, irrigation et gestion de l''eau.',
       v_school_agri, 7, 'debutant', 0, 12.0, 4.8, 63, 2450, false, 'from-emerald-800 to-lime-600'),
      ('comptabilite-syscohada', 'Comptabilité SYSCOHADA révisée', 'Tenir une comptabilité complète et produire des états financiers conformes.',
       v_school_fin, 8, 'intermediaire', 34999, 26.0, 4.6, 87, 1640, true, 'from-sky-700 to-electric-600'),
      ('fiscalite-niger', 'Fiscalité pratique au Niger', 'TVA, impôts sur les bénéfices, déclarations et relations avec l''administration.',
       v_school_fin, 9, 'intermediaire', 27999, 14.0, 4.4, 32, 720, false, 'from-sky-800 to-indigo-600'),
      ('marketing-digital-commerce', 'Marketing digital et commerce en ligne', 'Réseaux sociaux, tunnel de vente, publicité et fidélisation client.',
       v_school_mkt, 10, 'debutant', 17999, 20.0, 4.8, 168, 3890, true, 'from-pink-600 via-rose-500 to-night-700'),
      ('vente-negotiation', 'Vente et négociation commerciale', 'Prospecter, convaincre et négocier des contrats B2B dans le contexte local.',
       v_school_mkt, 11, 'intermediaire', 12999, 11.0, 4.3, 47, 1130, false, 'from-rose-700 to-gold-500'),
      ('energie-solaire-pompage', 'Énergie solaire : installation et pompage', 'Dimensionner, installer et maintenir des systèmes solaires de pompage.',
       v_school_ind, 12, 'intermediaire', 29999, 24.0, 4.9, 92, 2010, true, 'from-violet-700 to-electric-500'),
      ('electricite-industrielle', 'Électricité industrielle et sécurité', 'Schémas, protections électriques, maintenance préventive et normes de sécurité.',
       v_school_ind, 13, 'avance', 31999, 30.0, 4.5, 54, 890, false, 'from-violet-800 to-amber-600')
    ) as t(slug, title_fr, subtitle_fr, school_id, inst_idx, level, price, hours, rating, rating_count, students, gradient)
  loop
    insert into public.courses (
      slug, school_id, instructor_id, title_fr, subtitle_fr, description_fr, level, status,
      language, duration_hours, price_xof, is_free, is_featured, cover_gradient,
      outcomes, prerequisites, audience, rating_avg, rating_count, enrollment_count,
      published_at
    )
    values (
      r.slug, r.school_id,
      case r.inst_idx when 1 then v_inst1 when 2 then v_inst2 when 3 then v_inst3
                      when 4 then v_inst4 when 5 then v_inst5 else v_inst6 end,
      r.title_fr, r.subtitle_fr,
      r.subtitle_fr || ' Ce parcours combine leçons vidéo, exercices corrigés et projet final évalué par le tuteur IA.',
      r.level::public.course_level, 'published', 'fr', r.hours, r.price,
      (r.price = 0), r.students > 2000, r.gradient,
      array['Maîtriser les notions clés du domaine',
            'Appliquer les méthodes acquises à un cas réel de votre secteur',
            'Préparer un projet professionnel évalué',
            'Obtenir un certificat vérifiable DIGINIGER'],
      array['Aucun prérequis technique avancé', 'Une connexion internet stable',
            'Motivation pour 3 à 5 heures de travail par semaine'],
      array['Étudiants et jeunes diplômés', 'Professionnels en reconversion', 'Entrepreneurs et responsables d''équipe'],
      r.rating, r.rating_count, r.students, now() - interval '90 days'
    )
    on conflict (slug) do update set
      title_fr = excluded.title_fr, subtitle_fr = excluded.subtitle_fr,
      school_id = excluded.school_id, price_xof = excluded.price_xof,
      is_free = excluded.is_free, is_featured = excluded.is_featured,
      rating_avg = excluded.rating_avg, rating_count = excluded.rating_count,
      enrollment_count = excluded.enrollment_count, status = excluded.status,
      cover_gradient = excluded.cover_gradient, outcomes = excluded.outcomes,
      prerequisites = excluded.prerequisites, audience = excluded.audience,
      instructor_id = coalesce(public.courses.instructor_id, excluded.instructor_id);

    select id into v_course from public.courses where slug = r.slug;

    -- Trois modules par formation, avec leçons (uniquement si absents)
    if not exists (select 1 from public.modules where course_id = v_course) then
      insert into public.modules (course_id, title_fr, summary, position)
      values
        (v_course, 'Fondamentaux', 'Les concepts et le vocabulaire indispensable.', 1),
        (v_course, 'Application pratique', 'Les méthodes appliquées à des cas réels.', 2),
        (v_course, 'Projet et évaluation', 'Mettre en pratique et faire évaluer son travail.', 3)
      on conflict (course_id, position) do nothing;

      insert into public.lessons (module_id, title_fr, kind, content_md, duration_min, position, is_preview)
      select m.id, l.title, l.kind::text, l.content_md, l.duration, l.pos, (m.position = 1 and l.pos = 1)
        from public.modules m
        cross join (values
          (1, 'Introduction et objectifs', 'video',
           '# Introduction' || chr(10) || chr(10) || 'Nous posons le cadre du module et les objectifs d''apprentissage.', 12),
          (2, 'Concepts essentiels', 'reading',
           '# Concepts essentiels' || chr(10) || chr(10) || 'Cette fiche synthétise les notions clés avec des exemples adaptés au contexte nigérien.', 20),
          (3, 'Exercice guidé', 'exercise',
           'Mettez en pratique la notion du module à travers un exercice corrigé automatiquement.', 25)
        ) as l(pos, title, kind, content_md, duration)
       where m.course_id = v_course
      on conflict (module_id, position) do nothing;
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Offres d'abonnement : codes promo de démonstration
-- ---------------------------------------------------------------------------
insert into public.promo_codes (code, kind, value, max_redemptions, ends_at, is_active)
values
  ('DIGI10', 'percent', 10, 500, now() + interval '120 days', true),
  ('RENTREE5000', 'amount', 5000, 200, now() + interval '60 days', true)
on conflict (code) do update set is_active = excluded.is_active, value = excluded.value;
