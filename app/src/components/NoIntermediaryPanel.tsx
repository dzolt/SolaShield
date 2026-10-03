import { Card } from "../ui";

/** The answers to the questions the judges will ask, next to the app that proves them. */
export function NoIntermediaryPanel() {
  return (
    <Card title="🔍 Gdzie znika pośrednik">
      <div className="grid two">
        <div>
          <h3>Kto był pośrednikiem</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Ubezpieczyciel lub broker instrumentów pochodnych: trzyma kapitał, ustala warunki, ocenia, czy ochrona się
            należy, i decyduje o wypłacie. Trzeba mu ufać, że zapłaci, i że nie zmieni zasad.
          </p>
          <h3>Co robi program zamiast niego</h3>
          <ul className="muted">
            <li>Kapitał leży na koncie tokenów kontrolowanym wyłącznie przez program (PDA): żaden klucz go nie ruszy.</li>
            <li>Cenę referencyjną program czyta z Pytha sam przy zakupie, a próg liczy ze wzoru. Kupujący nie ma jak go zmienić.</li>
            <li>Wypłata wynika wyłącznie z ceny Pytha po terminie i idzie zawsze na konto właściciela ochrony.</li>
            <li>Rozliczyć może każdy. Nie ma zatwierdzania roszczeń, formularza ani konta administratora, które by o tym decydowało.</li>
            <li>Pula nie sprzeda więcej ochrony, niż ma kapitału, a jedna ochrona to najwyżej 20% puli.</li>
            <li>Wpłacony kapitał jest zablokowany na czas ustalony przy tworzeniu puli, więc dawca nie wycofa go tuż przed rozliczeniem.</li>
          </ul>
        </div>
        <div>
          <h3>Co jeśli ktoś zniknie</h3>
          <ul className="muted" style={{ marginTop: 0 }}>
            <li>Właściciel ochrony znika: ochrona i tak się rozliczy, a wypłata czeka na jego koncie.</li>
            <li>Nikt nie rozlicza przez 7 dni po końcu: każdy może ochronę unieważnić, składka wraca do właściciela.</li>
            <li>Dawca znika: jego udziały zostają w puli, nikt inny ich nie wypłaci.</li>
          </ul>
          <h3>Uczciwie o ograniczeniach</h3>
          <ul className="muted">
            <li>Cenę dostarcza Pyth. To rozproszona sieć publikatorów danych, nie my i nie żadna strona umowy, ale nadal
              zewnętrzne źródło prawdy.</li>
            <li>Rozliczenie bierze pierwszą cenę z okna 10 minut po końcu, więc obie strony mogą wybrać moment wywołania w
              tym oknie. Kto nie zdąży, nie dostaje wypłaty: po 7 dniach wraca tylko składka. Docelowo cena z dokładnej
              chwili końca (wymaga pobierania cen historycznych przez płatne API Pytha).</li>
            <li>Składka to stały procent wypłaty, a nie wycena opcji. Przy gwałtownym spadku SOL wszystkie ochrony płacą
              naraz, więc dawcy mogą stracić.</li>
            <li>Program da się zaktualizować, dopóki autor nie zablokuje tej możliwości. Admin może dodawać nowe
              produkty, ale nie ruszy środków ani istniejących ochron.</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
