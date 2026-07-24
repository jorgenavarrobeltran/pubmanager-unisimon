INSERT INTO people (id, full_name, country) VALUES
('7b5652c0-a5de-420b-909f-b24427821c0c', 'José Luis Ramos Camargo', 'Colombia'),
('1db70999-670d-4dfb-9bc0-e6c9653404da', 'José Antonio Sarmiento Pérez Polo', 'Colombia'),
('cb6482c4-fbbf-40b4-b591-98c8216035c2', 'Aldemar José De Moya Camacho', 'Colombia'),
('719f1a3c-27c0-41c7-914a-8ea3eb1256a4', 'Lorenleyn De la Hoz Alford', 'Colombia'),
('fccc39a6-7e34-4488-a88c-9c90a3770196', 'Sindy Henríquez Cera', 'Colombia'),
('40c00d31-0ef2-411d-b0cd-c22c144e069a', 'Eliceo Cortes Gómez', 'Colombia'),
('da4fb807-880c-4937-a43b-276d9c0ad1e6', 'Óscar Martínez Castro', 'Colombia'),
('be56cfd8-d518-4339-81bf-ccf7c9b64171', 'Juvenal Yosa Reyes', 'Colombia'),
('bbf35d0a-4262-4e4b-b532-d827b571b626', 'Evelina  De Jesús Aguilar Arrieta', 'Colombia'),
('70c85904-70cb-4c6d-bb1c-692fe23c1096', 'Sandra Ospino Bethin', 'Colombia'),
('650928b9-15b9-4344-b220-63bd3ee73643', 'Janye Liliana Rodríguez Cervantes', 'Colombia'),
('a8e573c6-b153-4a22-b8ed-f171d28f7271', 'Julio Villalba Puerta', 'Colombia'),
('d3725eb0-a54d-4780-827b-df6ea2807c67', 'Marco Antonio Pérez Suárez', 'Colombia'),
('fd6585b6-1385-44f2-8d51-a816d0091add', 'Viviana Covelli Sánchez', 'Colombia')
ON CONFLICT (id) DO NOTHING;