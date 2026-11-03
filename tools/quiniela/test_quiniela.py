"""Pruebas sin red: python3 -m unittest discover -s tools/quiniela"""
import os, sys, unittest
sys.path.insert(0, os.path.dirname(__file__))
import fuentes, modelo, estrategia, quiniela


class Nombres(unittest.TestCase):
    def test_parecidos(self):
        for a, b in [('MAN.UNITED', 'Manchester United'), ('AT.MADRID', 'Atlético Madrid'), ('B.MUNICH', 'Bayern Munich'),
                     ('R.SOCIEDAD', 'Real Sociedad'), ('OL. LYON', 'Lyon'), ('ATH.CLUB', 'Athletic Club'), ('OPORTO', 'FC Porto')]:
            self.assertGreater(fuentes.parecido(a, b), 0.75, (a, b))

    def test_no_confunde(self):
        self.assertLess(fuentes.parecido('R.SOCIEDAD', 'Real Madrid'), 0.6)
        self.assertLess(fuentes.parecido('B.MUNICH', 'Borussia Dortmund'), 0.5)

    def test_no_empareja_con_un_solo_equipo(self):
        ev = [dict(id='1', local='Barcelona', visitante='Aston Villa'), dict(id='2', local='Racing Santander', visitante='Valencia')]
        r = fuentes.emparejar([dict(n=1, local='BARCELONA', visitante='ALAVÉS'), dict(n=2, local='RACING S.', visitante='R.MADRID')], ev)
        self.assertIsNone(r[1][0]); self.assertIsNone(r[2][0])

    def test_emparejar(self):
        ev = [dict(id='1', local='Real Madrid', visitante='Real Sociedad'), dict(id='2', local='Real Sociedad', visitante='Lyon')]
        r = fuentes.emparejar([dict(n=1, local='R.SOCIEDAD', visitante='OL. LYON')], ev)
        self.assertEqual(r[1][0]['id'], '2')


class Modelo(unittest.TestCase):
    def test_sin_margen(self):
        p = fuentes.sin_margen([fuentes._prob_americana(-350), fuentes._prob_americana(600), fuentes._prob_americana(700)])
        self.assertAlmostEqual(sum(p), 1)
        self.assertGreater(p[0], 0.7)

    def test_combinar_suma_uno(self):
        p = modelo.combinar({'mercado': [.5, .3, .2], 'publico': [.6, .25, .15]}, modelo.PREVIO)
        self.assertAlmostEqual(sum(p), 1)
        self.assertGreater(p[0], p[2])

    def test_sin_fuentes(self):
        self.assertEqual(modelo.combinar({}, modelo.PREVIO), [1 / 3] * 3)

    def test_aprende_el_sesgo_de_empates(self):
        # Fuentes que dicen 20% de empate cuando salen el 40%: el sesgo de la X tiene que subir
        filas = [({'losilla': [.4, .2, .4], 'publico': [.4, .2, .4]}, y) for y in [1] * 40 + [0] * 30 + [2] * 30]
        p = modelo.entrenar(filas, iters=200)
        self.assertGreater(p['sesgo'][1], 0.3)

    def test_lambdas_reproducen_1x2(self):
        lh, la = modelo.lambdas([.6, .25, .15])
        q = modelo._1x2(modelo.matriz(lh, la))
        self.assertLess(abs(q[0] - .6) + abs(q[2] - .15), 0.05)


class Estrategia(unittest.TestCase):
    P = [[.7, .2, .1], [.4, .35, .25], [.34, .33, .33], [.8, .15, .05]]

    def test_dobles_en_los_igualados(self):
        s = estrategia.elegir(self.P, 2)
        self.assertEqual(s[0], '1'); self.assertEqual(s[3], '1')
        self.assertEqual(len(s[1]), 2); self.assertEqual(len(s[2]), 2)

    def test_distribucion(self):
        d = estrategia.distribucion([.5, .5])
        self.assertEqual([round(x, 2) for x in d], [.25, .5, .25])

    def test_coste(self):
        r = estrategia.resumen(self.P, estrategia.elegir(self.P, 2))
        self.assertEqual(r['apuestas'], 4); self.assertEqual(r['coste'], 3.0)

    def test_premio_columnas(self):
        tabla = [dict(acierto=k, premio=v) for k, v in [(15, 1e6), (14, 1e5), (13, 1e3), (12, 50), (11, 5), (10, 0)]]
        signos = ['1'] * 13 + ['12']
        total, mejor = quiniela.premio_columnas(signos, ['1'] * 14, tabla, False)
        self.assertEqual(mejor, 14); self.assertEqual(total, 1e5 + 1e3)

    def test_tipo_fallo(self):
        self.assertEqual(quiniela.tipo_fallo([.7, .2, .1], 2), 'sorpresa')
        self.assertEqual(quiniela.tipo_fallo([.45, .3, .25], 2), 'igualado')
        self.assertEqual(quiniela.tipo_fallo([.55, .2, .25], 2), 'falla el favorito')


if __name__ == '__main__':
    unittest.main()
